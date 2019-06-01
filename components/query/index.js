const Joi = require("joi");
const { getRecords } = require("../store");
const {
  parseISO,
  eachDayOfInterval,
  eachWeekOfInterval,
  startOfSecond,
  startOfMinute,
  startOfHour,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  differenceInSeconds,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  differenceInMonths,
  differenceInYears
} = require("date-fns");
const {
  eachSecondOfInterval,
  eachMinuteOfInterval,
  eachHourOfInterval,
  eachMonthOfInterval,
  eachYearOfInterval
} = require("../../utils");

const aggProps = {
  agg: Joi.string()
    .valid([
      "average",
      "count",
      "max",
      "median",
      "min",
      "percentileRanks",
      "percentiles",
      "standardDeviation",
      "sum",
      "topHit",
      "uniqueCount"
    ])
    .required(),
  field: Joi.any().when(Joi.ref("agg"), {
    is: "count",
    then: Joi.forbidden(),
    otherwise: Joi.string().required()
  })
};

const queryProps = {
  type: Joi.string()
    .valid([
      "dateHistogram",
      "histogram",
      "significantTerms",
      "thresholdTerms",
      "terms"
    ])
    .required(),
  field: Joi.string().required(),
  placeholders: Joi.array().items(Joi.string().required()),
  interval: Joi.string().when(Joi.ref("type"), {
    is: "dateHistogram",
    then: Joi.string()
      .valid([
        "auto",
        "millisecond",
        "second",
        "minute",
        "hourly",
        "daily",
        "weekly",
        "monthly",
        "yearly"
      ])
      .required(),
    otherwise: Joi.forbidden()
  }),
  histogramInterval: Joi.number().when(Joi.ref("type"), {
    is: "histogram",
    then: Joi.number()
      .min(0.001)
      .required(),
    otherwise: Joi.forbidden()
  }),
  size: Joi.any().when(Joi.ref("type"), {
    is: "thresholdTerms",
    then: Joi.number()
      .min(1)
      .required(),
    otherwise: Joi.forbidden()
  }),
  order: Joi.string().valid(["desc", "asc"]),
  values: Joi.object()
    .keys(aggProps)
    .required(),
  split: Joi.object().keys({
    field: Joi.string().required(),
    op: Joi.string()
      .valid([
        "histogram",
        "either side of number",
        "terms",
        "boolean",
        "exists"
      ])
      .required(),
    value: Joi.any().when("op", {
      is: Joi.only(["either side of number"]),
      then: Joi.any().required(),
      otherwise: Joi.forbidden()
    }),
    histogramInterval: Joi.number().when(Joi.ref("op"), {
      is: "histogram",
      then: Joi.number()
        .min(0.001)
        .required(),
      otherwise: Joi.forbidden()
    }),
    size: Joi.any().when("op", {
      is: Joi.only(["terms"]),
      then: Joi.number()
        .min(2)
        .required(),
      otherwise: Joi.forbidden()
    })
  })
};

const schema = Joi.object().keys({
  collection: Joi.string()
    .valid(["events"])
    .required(),
  type: Joi.string()
    .valid(["chart", "list", "value"])
    .required(),
  from: Joi.date()
    .iso()
    .required(),
  to: Joi.date()
    .iso()
    .required(),
  query: Joi.any().when("type", {
    is: "chart",
    then: Joi.object()
      .keys(queryProps)
      .required(),
    otherwise: Joi.forbidden()
  }),
  where: Joi.array().items(
    Joi.object().keys({
      field: Joi.string().required(),
      op: Joi.string()
        .valid([
          "is",
          "is not",
          "is one of",
          "is not one of",
          "is between",
          "is not between",
          "exists",
          "does not exist",
          "is less than",
          "is greater than"
        ])
        .required(),
      value: Joi.any().when("op", {
        is: Joi.only(["is", "is not", "is less than", "is greater than"]),
        then: Joi.any().required(),
        otherwise: Joi.forbidden()
      }),
      values: Joi.any().when("op", {
        is: Joi.only([
          "is one of",
          "is not one of",
          "is between",
          "is not between"
        ]),
        then: Joi.array().when("op", {
          is: Joi.only(["is between", "is not between"]),
          then: Joi.array()
            .items(Joi.number().required())
            .min(2)
            .max(2)
            .required(),
          otherwise: Joi.array()
            .items(Joi.any().required())
            .min(2)
            .required()
        }),
        otherwise: Joi.forbidden()
      })
    })
  ),
  limit: Joi.any().when(Joi.ref("type"), {
    is: "list",
    then: Joi.number()
      .min(1)
      .default(100),
    otherwise: Joi.forbidden()
  }),
  fromRecord: Joi.any().when(Joi.ref("type"), {
    is: "list",
    then: Joi.string().uuid(),
    otherwise: Joi.forbidden()
  }),
  orderBy: Joi.any().when(Joi.ref("type"), {
    is: "list",
    then: Joi.string(),
    otherwise: Joi.forbidden()
  }),
  order: Joi.any().when(Joi.ref("type"), {
    is: "list",
    then: Joi.string().valid(["desc", "asc"]),
    otherwise: Joi.forbidden()
  })
});

const calculateSignificantTermsScore = (
  supersetFrequency,
  supersetSize,
  subsetFrequency,
  subsetSize
) => {
  if (subsetSize === 0 || supersetSize === 0) {
    return 0;
  }
  if (supersetFrequency === 0) {
    supersetFrequency = 1;
  }
  const subsetProbability = subsetFrequency / subsetSize;
  const supersetProbability = supersetFrequency / supersetSize;
  const absoluteProbabilityChange = subsetProbability - supersetProbability;
  if (absoluteProbabilityChange <= 0) {
    return 0;
  }
  const relativeProbabilityChange = subsetProbability / supersetProbability;
  return absoluteProbabilityChange * relativeProbabilityChange;
};

module.exports = async (req, res) => {
  const result = Joi.validate(req.body, schema);
  if (result.error) {
    res.json({
      type: "ValidationError",
      details: result.error.details
    });
    return;
  }
  const query = result.value;

  let records = await getRecords(
    query.collection,
    query.from.toISOString(),
    query.to.toISOString(),
    query.where || []
  );
  const totalRecords = records.length;
  if (query.fromRecord) {
    const fromIndex = records.findIndex(v => v.id === query.fromRecord);
    if (fromIndex !== -1) {
      records = records.slice(fromIndex);
    }
  }
  if (query.limit) {
    records = records.slice(0, parseInt(query.limit, 10));
  }
  if (query.type === "list") {
    res.json({
      results: records,
      total: totalRecords
    });
    return;
  } else if (query.type === "chart") {
    const xFieldPath = query.query.field.split(".");
    const yFieldPath = query.query.values.field
      ? query.query.values.field.split(".")
      : [];

    records = records
      .map(record => {
        const finalRecord = {
          ...record,
          tmpX: xFieldPath.reduce((o, i) => o[i], record),
          tmpY: yFieldPath.reduce((o, i) => o[i], record)
        };
        return finalRecord;
      })
      .filter(record => {
        if (!record) {
          return false;
        }
        if (typeof record.tmpX === "undefined") {
          return false;
        }
        return true;
      }); // removes undefined records
    records.sort((a, b) => {
      if (a.tmpX < b.tmpX) {
        return -1;
      }
      if (a.tmpX > b.tmpX) {
        return 1;
      }
      return 0;
    });
    const min = records[0] ? records[0].tmpX : 0;
    const max = records[0] ? records[records.length - 1].tmpX : 0;
    let xBuckets = {};
    let xBucketKeys = {};
    let totalXBuckets = 0;

    switch (query.query.type) {
      case "histogram":
        for (let i = min; i <= max; i += query.query.histogramInterval) {
          xBuckets[i] = {
            values: []
          };
        }
        xBucketKeys = Object.keys(xBuckets);
        totalXBuckets = xBucketKeys.length;
        records.forEach(record => {
          for (let i = 0; i < totalXBuckets; i += 1) {
            if (record.tmpX >= xBucketKeys[i]) {
              if (
                !xBucketKeys[i + 1] ||
                (xBucketKeys[i + 1] && record.tmpX < xBucketKeys[i + 1])
              ) {
                xBuckets[xBucketKeys[i]].values.push(record);
              }
            }
          }
        });
        break;
      case "terms":
        records.forEach(record => {
          if (!xBuckets[record.tmpX]) {
            xBuckets[record.tmpX] = { values: [] };
          }
          xBuckets[record.tmpX].values.push(record);
        });
        xBucketKeys = Object.keys(xBuckets);
        totalXBuckets = xBucketKeys.length;
        break;
      case "thresholdTerms":
        records.forEach(record => {
          if (!xBuckets[record.tmpX]) {
            xBuckets[record.tmpX] = { values: [] };
          }
          xBuckets[record.tmpX].values.push(record);
        });
        Object.keys(xBuckets).forEach(key => {
          if (xBuckets[key].values.length < parseInt(query.query.size, 10)) {
            delete xBuckets[key];
          }
        });
        xBucketKeys = Object.keys(xBuckets);
        totalXBuckets = xBucketKeys.length;

        break;
      case "significantTerms":
        const totalFrontRecords = records.length;
        records.forEach(record => {
          if (!xBuckets[record.tmpX]) {
            xBuckets[record.tmpX] = {
              values: []
            };
          }
          xBuckets[record.tmpX].values.push(record);
        });

        let allRecords = await getRecords(
          query.collection,
          undefined,
          undefined,
          query.where || []
        );
        const totalBackRecords = allRecords.length;
        let backXBuckets = {};
        allRecords.forEach(record => {
          if (!backXBuckets[record.tmpX]) {
            backXBuckets[record.tmpX] = { values: [] };
          }
          backXBuckets[record.tmpX].values.push(record);
        });

        xBucketKeys = Object.keys(xBuckets);
        let validXBuckets = {};

        xBucketKeys.forEach(key => {
          const score = calculateSignificantTermsScore(
            backXBuckets[key] ? backXBuckets[key].values.length : 0,
            totalBackRecords,
            xBuckets[key].values.length,
            totalFrontRecords
          );
          if (score > 0) {
            validXBuckets[key] = xBuckets[key];
            validXBuckets[key].score = score;
          }
        });
        xBuckets = validXBuckets;
        xBucketKeys = Object.keys(xBuckets);
        totalXBuckets = xBucketKeys.length;
        break;
      case "dateHistogram":
        const from = query.from;
        const to = query.to;
        switch (query.query.interval) {
          case "second":
            if (differenceInSeconds(to, from) > 300) {
              res.json({
                error:
                  "Total number of seconds must be less than 300 (5 minutes)"
              });
              return;
            }
            var range = eachSecondOfInterval({
              start: from,
              end: to
            });

            range.forEach(rangeItem => {
              if (!xBuckets[rangeItem.toISOString()]) {
                xBuckets[rangeItem.toISOString()] = { values: [] };
              }
            });
            records.forEach(record => {
              const v = startOfSecond(parseISO(record.tmpX)).toISOString();
              if (xBuckets[v]) {
                xBuckets[v].values.push(record);
              }
            });
            break;
          case "minute":
            if (differenceInMinutes(to, from) > 1440) {
              res.json({
                error: "Total number of minutes must be less than 1400 (1 day)"
              });
              return;
            }
            var range = eachMinuteOfInterval({
              start: from,
              end: to
            });

            range.forEach(rangeItem => {
              if (!xBuckets[rangeItem.toISOString()]) {
                xBuckets[rangeItem.toISOString()] = { values: [] };
              }
            });
            records.forEach(record => {
              const v = startOfMinute(parseISO(record.tmpX)).toISOString();
              if (xBuckets[v]) {
                xBuckets[v].values.push(record);
              }
            });
            break;
          case "hourly":
            if (differenceInHours(to, from) > 672) {
              res.json({
                error: "Total number of hours must be less than 672 (1 month)"
              });
              return;
            }

            var range = eachHourOfInterval({
              start: from,
              end: to
            });

            range.forEach(rangeItem => {
              if (!xBuckets[rangeItem.toISOString()]) {
                xBuckets[rangeItem.toISOString()] = { values: [] };
              }
            });
            records.forEach(record => {
              const v = startOfHour(parseISO(record.tmpX)).toISOString();
              if (xBuckets[v]) {
                xBuckets[v].values.push(record);
              }
            });
            break;
          case "daily":
            if (differenceInDays(to, from) > 1095) {
              res.json({
                error: "Total number of days must be less than 1095 (3 years)"
              });
              return;
            }

            var range = eachDayOfInterval({
              start: from,
              end: to
            });

            range.forEach(rangeItem => {
              if (!xBuckets[rangeItem.toISOString()]) {
                xBuckets[rangeItem.toISOString()] = { values: [] };
              }
            });
            records.forEach(record => {
              const v = startOfDay(parseISO(record.tmpX)).toISOString();
              if (xBuckets[v]) {
                xBuckets[v].values.push(record);
              }
            });
            break;
          case "weekly":
            if (differenceInWeeks(to, from) > 1060) {
              res.json({
                error: "Total number of weeks must be less than 1060 (20 years)"
              });
              return;
            }
            var range = eachWeekOfInterval({
              start: from,
              end: to
            });
            range.forEach(rangeItem => {
              if (!xBuckets[rangeItem.toISOString()]) {
                xBuckets[rangeItem.toISOString()] = { values: [] };
              }
            });
            records.forEach(record => {
              const v = startOfWeek(parseISO(record.tmpX)).toISOString();
              if (xBuckets[v]) {
                xBuckets[v].values.push(record);
              }
            });
            break;
          case "monthly":
            if (differenceInMonths(to, from) > 1200) {
              res.json({
                error:
                  "Total number of months must be less than 1200 (100 years)"
              });
              return;
            }
            var range = eachMonthOfInterval({
              start: from,
              end: to
            });
            range.forEach(rangeItem => {
              if (!xBuckets[rangeItem.toISOString()]) {
                xBuckets[rangeItem.toISOString()] = { values: [] };
              }
            });
            records.forEach(record => {
              const v = startOfMonth(parseISO(record.tmpX)).toISOString();
              if (xBuckets[v]) {
                xBuckets[v].values.push(record);
              }
            });
            break;
          case "yearly":
            if (differenceInYears(to, from) > 1000) {
              res.json({
                error: "Total number of years must be less than 1000"
              });
              return;
            }

            var range = eachYearOfInterval({
              start: from,
              end: to
            });
            range.forEach(rangeItem => {
              if (!xBuckets[rangeItem.toISOString()]) {
                xBuckets[rangeItem.toISOString()] = { values: [] };
              }
            });
            records.forEach(record => {
              const v = startOfYear(parseISO(record.tmpX)).toISOString();
              if (xBuckets[v]) {
                xBuckets[v].values.push(record);
              }
            });
            break;
        }
        xBucketKeys = Object.keys(xBuckets);
        totalXBuckets = xBucketKeys.length;
        break;
    }

    records = [];

    const series = [];
    if (query.query.split) {
      const splitFieldPath = query.query.split.field.split(".");

      switch (query.query.split.op) {
        case "either side of number":
          series1 = {
            label: `<=${query.query.split.value}`,
            raw: {},
            byKey: {},
            data: []
          };

          series2 = {
            label: `>${query.query.split.value}`,
            raw: {},
            byKey: {},
            data: []
          };

          xBucketKeys.forEach(key => {
            series1.raw[key] = { values: [] };
            series2.raw[key] = { values: [] };
          });

          Object.keys(xBuckets).forEach(bucketKey => {
            xBuckets[bucketKey].values.forEach(record => {
              const splitValue = splitFieldPath.reduce((o, i) => o[i], record);
              if (typeof splitValue !== "undefined") {
                if (splitValue <= query.query.split.value) {
                  series1.raw[bucketKey].values.push(record);
                } else {
                  series2.raw[bucketKey].values.push(record);
                }
              }
            });
          });

          series.push(series1);
          series.push(series2);
          break;
        case "terms": {
          const splitByValue = {};
          Object.keys(xBuckets).forEach(bucketKey => {
            xBuckets[bucketKey].values.forEach(record => {
              const splitValue = splitFieldPath.reduce((o, i) => o[i], record);
              if (typeof splitValue !== "undefined") {
                if (!splitByValue[splitValue]) {
                  splitByValue[splitValue] = {};
                  xBucketKeys.forEach(key => {
                    splitByValue[splitValue][key] = { values: [] };
                  });
                }
                splitByValue[splitValue][bucketKey].values.push(record);
              }
            });
          });
          let splitCounter = 1;
          Object.keys(splitByValue).forEach(splitByValueKey => {
            if (
              query.query.split.size &&
              splitCounter > query.query.split.size
            ) {
              return;
            }
            series.push({
              label: splitByValueKey,
              raw: splitByValue[splitByValueKey],
              byKey: {},
              data: []
            });
            splitCounter += 1;
          });
          break;
        }
        case "boolean": {
          series1 = {
            label: `True`,
            raw: {},
            byKey: {},
            data: []
          };

          series2 = {
            label: `False`,
            raw: {},
            byKey: {},
            data: []
          };

          xBucketKeys.forEach(key => {
            series1.raw[key] = { values: [] };
            series2.raw[key] = { values: [] };
          });

          Object.keys(xBuckets).forEach(bucketKey => {
            xBuckets[bucketKey].values.forEach(record => {
              const splitValue = splitFieldPath.reduce((o, i) => o[i], record);
              if (typeof splitValue !== "undefined") {
                if (splitValue === true) {
                  series1.raw[bucketKey].values.push(record);
                } else if (splitValue === false) {
                  series2.raw[bucketKey].values.push(record);
                }
              }
            });
          });

          series.push(series1);
          series.push(series2);
          break;
        }
        case "exists": {
          series1 = {
            label: `Exists`,
            raw: {},
            byKey: {},
            data: []
          };

          series2 = {
            label: `Doesn't exist`,
            raw: {},
            byKey: {},
            data: []
          };

          xBucketKeys.forEach(key => {
            series1.raw[key] = { values: [] };
            series2.raw[key] = { values: [] };
          });

          Object.keys(xBuckets).forEach(bucketKey => {
            xBuckets[bucketKey].values.forEach(record => {
              const splitValue = splitFieldPath.reduce((o, i) => o[i], record);
              if (typeof splitValue !== "undefined") {
                series1.raw[bucketKey].values.push(record);
              } else {
                series2.raw[bucketKey].values.push(record);
              }
            });
          });

          series.push(series1);
          series.push(series2);
          break;
        }
        case "histogram": {
          let values = [];
          Object.keys(xBuckets).forEach(bucketKey => {
            xBuckets[bucketKey].values.forEach(record => {
              const v = splitFieldPath.reduce((o, i) => o[i], record);
              if (typeof v !== "undefined") {
                values.push(v);
              }
            });
          });
          const minSplit = Math.min(...values);
          const maxSplit = Math.max(...values);
          values = [];
          const splitByValue = {};

          for (
            let i = minSplit;
            i <= maxSplit;
            i += query.query.split.histogramInterval
          ) {
            splitByValue[i] = {};
            xBucketKeys.forEach(key => {
              splitByValue[i][key] = { values: [] };
            });
          }

          const splitByValueKeys = Object.keys(splitByValue);
          Object.keys(xBuckets).forEach(bucketKey => {
            xBuckets[bucketKey].values.forEach(record => {
              const splitValue = splitFieldPath.reduce((o, i) => o[i], record);
              if (typeof splitValue !== "undefined") {
                splitByValueKeys.forEach((splitByValueKey, i) => {
                  if (splitValue >= parseFloat(splitByValueKey)) {
                    if (
                      !splitByValueKeys[i + 1] ||
                      (splitByValueKeys[i + 1] &&
                        splitValue < parseFloat(splitByValueKeys[i + 1]))
                    ) {
                      splitByValue[splitByValueKey][bucketKey].values.push(
                        record
                      );
                    }
                  }
                });
              }
            });
          });
          splitByValueKeys.forEach(splitByValueKey => {
            series.push({
              label: splitByValueKey,
              raw: splitByValue[splitByValueKey],
              byKey: {},
              data: []
            });
          });
          break;
        }
      }
    } else {
      series.push({
        raw: xBuckets,
        byKey: {},
        data: []
      });
    }
    xBuckets = {};
    series.forEach((serie, key) => {
      for (let i = 0; i < totalXBuckets; i += 1) {
        switch (query.query.values.agg) {
          case "count": {
            series[key].byKey[xBucketKeys[i]] =
              serie.raw[xBucketKeys[i]].values.length;
            break;
          }
          case "average": {
            let counter = 0;
            const sum = serie.raw[xBucketKeys[i]].values.reduce(
              (previous, current) => {
                let v = parseFloat(current.tmpY);
                if (isNaN(v)) {
                  return previous;
                }
                counter += 1;
                if (previous === null) {
                  return v;
                }
                return previous + v;
              },
              null
            );
            series[key].byKey[xBucketKeys[i]] = sum / counter;
            break;
          }
          case "max":
            series[key].byKey[xBucketKeys[i]] = serie.raw[
              xBucketKeys[i]
            ].values.reduce((previous, current) => {
              let v = parseFloat(current.tmpY);
              if (isNaN(v)) {
                return previous;
              }
              if (previous === null) {
                return v;
              }
              return Math.max(previous, v);
            }, null);
            break;
          case "median":
            const values = serie.raw[xBucketKeys[i]].values
              .map(record => {
                let v = parseFloat(record.tmpY);
                if (isNaN(v)) {
                  return undefined;
                }
                return v;
              })
              .filter(v => v)
              .sort((a, b) => a - b);
            const lowMiddle = Math.floor((values.length - 1) / 2);
            const highMiddle = Math.ceil((values.length - 1) / 2);
            series[key].byKey[xBucketKeys[i]] =
              (values[lowMiddle] + values[highMiddle]) / 2;
            break;
          case "min":
            series[key].byKey[xBucketKeys[i]] = serie.raw[
              xBucketKeys[i]
            ].values.reduce(function(previous, current) {
              let v = parseFloat(current.tmpY);
              if (isNaN(v)) {
                return previous;
              }
              if (previous === null) {
                return v;
              }
              return Math.min(previous, v);
            }, null);
            break;
          case "percentileRanks":
            break;
          case "percentiles":
            break;
          case "standardDeviation":
            break;
          case "sum":
            series[key].byKey[xBucketKeys[i]] = serie.raw[
              xBucketKeys[i]
            ].values.reduce(function(previous, current) {
              let v = parseFloat(current.tmpY);
              if (isNaN(v)) {
                return previous;
              }
              if (previous === null) {
                return v;
              }
              return previous + v;
            }, null);
            break;
          case "topHit":
            break;
          case "uniqueCount": {
            const values = serie.raw[xBucketKeys[i]].values.map(record =>
              parseFloat(record.tmpY)
            );
            const uniqueValues = [...new Set(values)];
            series[key].byKey[xBucketKeys[i]] = uniqueValues.length;
            break;
          }
        }
      }
      delete series[key].raw;
    });
    if (query.query.split) {
      res.json({
        labels: Object.keys(series[0].byKey),
        series: series.map(serie => {
          const newSerie = { ...serie, data: Object.values(serie.byKey) };
          delete newSerie.byKey;
          return newSerie;
        })
      });
      return;
    }

    var sortable = [];
    for (const key in series[0].byKey) {
      sortable.push([key, series[0].byKey[key]]);
    }
    if (query.query.order) {
      sortable.sort(function(a, b) {
        return query.query.order === "asc" ? a[1] - b[1] : b[1] - a[1];
      });
    }
    const dataToReturn = {
      labels: sortable.map(arrItem => arrItem[0]),
      series: [{ data: sortable.map(arrItem => arrItem[1]) }]
    };

    res.json(dataToReturn);
    return;
  }

  res.json({});
};
