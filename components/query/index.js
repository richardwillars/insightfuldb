const Joi = require("joi");
const { getRecords } = require("../store");
const chartProps = {
  type: Joi.string()
    .valid([
      "dateHistogram",
      "dateRange",
      "filters",
      "histogram",
      "range",
      "significantTerms",
      "terms"
    ])
    .required(),
  field: Joi.string(),
  placeholders: Joi.array().items(Joi.string().required()),
  interval: Joi.string().when(Joi.ref("type"), {
    is: "dateHistogram",
    then: Joi.string().valid([
      "auto",
      "millisecond",
      "second",
      "minute",
      "hourly",
      "daily",
      "weekly",
      "monthly",
      "yearly"
    ]),
    otherwise: Joi.forbidden()
  }),
  minimumInterval: Joi.number().when(Joi.ref("type"), {
    is: "histogram",
    then: Joi.number().min(0.001),
    otherwise: Joi.forbidden()
  }),
  size: Joi.any()
    .when(Joi.ref("type"), {
      is: "terms",
      then: Joi.number().min(1)
    })
    .when(Joi.ref("type"), {
      is: "significantTerms",
      then: Joi.number()
        .min(1)
        .required(),
      otherwise: Joi.forbidden()
    }),
  order: Joi.any().when(Joi.ref("type"), {
    is: "terms",
    then: Joi.string().valid(["desc", "asc"]),
    otherwise: Joi.forbidden()
  }),
  split: Joi.object().keys({
    agg: Joi.string()
      .valid([
        "dateHistogram",
        "dateRange",
        "filters",
        "histogram",
        "range",
        "significantTerms",
        "terms"
      ])
      .required(),
    field: Joi.string().required(),
    orderBy: Joi.string(),
    order: Joi.string().valid(["desc", "asc"]),
    minimumInterval: Joi.number().min(0.001),
    size: Joi.number().min(0),
    interval: Joi.string().valid([
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
  })
};

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

const pieAggProps = {
  agg: Joi.string()
    .valid(["count", "sum", "topHit", "uniqueCount"])
    .required(),
  field: Joi.any().when(Joi.ref("agg"), {
    is: "count",
    then: Joi.forbidden(),
    otherwise: Joi.string().required()
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
  x: Joi.any().when("type", {
    is: "chart",
    then: Joi.object()
      .keys(chartProps)
      .required(),
    otherwise: Joi.forbidden()
  }),
  y: Joi.any().when("type", {
    is: "chart",
    then: Joi.object()
      .keys(aggProps)
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
    const xFieldPath = query.x.field.split(".");
    const yFieldPath = query.y.field ? query.y.field.split(".") : [];

    records = records.map(record => {
      return {
        ...record,
        tmpX: xFieldPath.reduce((o, i) => o[i], record),
        tmpY: yFieldPath.reduce((o, i) => o[i], record)
      };
    });
    records.sort((a, b) => {
      if (a.tmpX < b.tmpX) {
        return -1;
      }
      if (a.tmpX > b.tmpX) {
        return 1;
      }
      return 0;
    });
    const min = records[0].tmpX;
    const max = records[records.length - 1].tmpX;
    let xBuckets = {};
    let xBucketKeys = {};
    let totalXBuckets = 0;

    switch (query.x.type) {
      case "histogram":
        for (let i = min; i <= max; i += query.x.minimumInterval) {
          xBuckets[i] = [];
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
                xBuckets[xBucketKeys[i]].push(record);
              }
            }
          }
        });
        break;
      case "terms":
        records.forEach(record => {
          if (!xBuckets[record.tmpX]) {
            xBuckets[record.tmpX] = [];
          }
          xBuckets[record.tmpX].push(record);
        });
        xBucketKeys = Object.keys(xBuckets);
        totalXBuckets = xBucketKeys.length;
        break;
      case "significantTerms":
        records.forEach(record => {
          if (!xBuckets[record.tmpX]) {
            xBuckets[record.tmpX] = [];
          }
          xBuckets[record.tmpX].push(record);
        });

        Object.keys(xBuckets).forEach(key => {
          if (xBuckets[key].length < parseInt(query.x.size, 10)) {
            delete xBuckets[key];
          }
        });
        xBucketKeys = Object.keys(xBuckets);
        totalXBuckets = xBucketKeys.length;
        break;
    }
    const chart = {};
    for (let i = 0; i < totalXBuckets; i += 1) {
      switch (query.y.agg) {
        case "count": {
          chart[xBucketKeys[i]] = xBuckets[xBucketKeys[i]].length;
          break;
        }
        case "average": {
          const sum = xBuckets[xBucketKeys[i]].reduce(
            (previous, current) => previous + parseFloat(current.tmpY),
            0
          );
          chart[xBucketKeys[i]] = sum / xBuckets[xBucketKeys[i]].length;
          break;
        }
        case "max":
          chart[xBucketKeys[i]] = xBuckets[xBucketKeys[i]].reduce(function(
            previous,
            current
          ) {
            return Math.max(previous, parseFloat(current.tmpY));
          },
          0);
          break;
        case "median":
          const values = xBuckets[xBucketKeys[i]]
            .map(record => parseFloat(record.tmpY))
            .sort((a, b) => a - b);
          const lowMiddle = Math.floor((values.length - 1) / 2);
          const highMiddle = Math.ceil((values.length - 1) / 2);
          chart[xBucketKeys[i]] = (values[lowMiddle] + values[highMiddle]) / 2;

          break;
        case "min":
          chart[xBucketKeys[i]] = xBuckets[xBucketKeys[i]].reduce(function(
            previous,
            current
          ) {
            return Math.min(previous, parseFloat(current.tmpY));
          },
          0);
          break;
        case "percentileRanks":
          break;
        case "percentiles":
          break;
        case "standardDeviation":
          break;
        case "sum":
          chart[xBucketKeys[i]] = xBuckets[xBucketKeys[i]].reduce(function(
            previous,
            current
          ) {
            return previous + parseFloat(current.tmpY);
          },
          0);
          break;
        case "topHit":
          break;
        case "uniqueCount": {
          const values = xBuckets[xBucketKeys[i]].map(record =>
            parseFloat(record.tmpY)
          );
          const uniqueValues = [...new Set(values)];
          chart[xBucketKeys[i]] = uniqueValues.length;
          break;
        }
      }
    }
    xBuckets = {};
    records = [];
    res.json(chart);
    return;
  }

  res.json({});
};
