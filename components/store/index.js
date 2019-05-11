const uuid = require("uuid");
const util = require("util");
const readline = require("readline");
const fs = require("fs");
const eventSchema = require("../../eventSchema");
const intersection = require("lodash/intersection");
const store = {
  events: []
};
const collections = ["events"];

const writeFile = util.promisify(fs.writeFile);
const appendFile = util.promisify(fs.appendFile);

const flattenObject = (ob, retainValue) => {
  var toReturn = {};
  for (var i in ob) {
    if (!ob.hasOwnProperty(i)) continue;
    if (typeof ob[i] == "object" && ob[i] !== null) {
      var flatObject = flattenObject(ob[i], retainValue);
      for (var x in flatObject) {
        if (!flatObject.hasOwnProperty(x)) continue;
        toReturn[i + "." + x] = retainValue ? flatObject[x] : {};
      }
    } else {
      toReturn[i] = retainValue ? ob[i] : {};
    }
  }
  return toReturn;
};

const indexEvent = (event, collection, positionOfEventInStore) => {
  const flatEvent = flattenObject(event, true);
  Object.keys(flatEvent).forEach(key => {
    if (!indexes[collection][key][flatEvent[key]]) {
      indexes[collection][key][flatEvent[key]] = [];
    }
    indexes[collection][key][flatEvent[key]].push(positionOfEventInStore);
    console.log(indexTypes[key]);
    if (indexTypes[key] === "date") {
      const ordered = {};
      Object.keys(indexes[collection][key])
        .sort()
        .forEach(function(i) {
          ordered[i] = indexes[collection][key][i];
        });
      indexes[collection][key] = ordered;
    }
  });
};

//load the events data into memory
if (fs.existsSync("./data/data-events.json")) {
  let rl = readline.createInterface({
    input: fs.createReadStream("./data/data-events.json")
  });
  let dataEventsLineNumber = 0;
  rl.on("line", function(line) {
    dataEventsLineNumber++;
    store["events"].push(JSON.parse(line));
  });
  rl.on("close", function(line) {
    console.log(`Loaded events data: ${dataEventsLineNumber} lines`);
  });
}

const emptyIndexes = flattenObject(eventSchema, false);
const indexTypes = flattenObject(eventSchema, true);
Object.keys(indexTypes).forEach(indexKey => {
  let type = indexTypes[indexKey].split(":");
  if (indexTypes[indexKey].includes("isodate")) {
    indexTypes[indexKey] = "date";
  } else {
    indexTypes[indexKey] = type[0];
  }
});

const indexes = {};
collections.forEach(collection => {
  if (fs.existsSync(`./data/indexes-${collection}.json`)) {
    indexes[collection] = JSON.parse(
      fs.readFileSync(`./data/indexes-${collection}.json`)
    );
  } else {
    indexes[collection] = { ...emptyIndexes };
  }
});

const api = {
  insertEvent: async event => {
    const newEvent = { ...event, id: uuid.v4() };
    store["events"].push(newEvent);
    const positionOfEventInStore = store["events"].length - 1;
    indexEvent(newEvent, "events", positionOfEventInStore);
    await appendFile(
      "./data/data-events.json",
      `${JSON.stringify(newEvent)}\n`
    );
    await writeFile(
      "./data/indexes-events.json",
      JSON.stringify(indexes["events"])
    );
  },
  getRecords: async (collection, from, to, where) => {
    //Get all the records indexes between the specific timestamps
    const validTimestamps = Object.keys(
      indexes[collection]["event.when"]
    ).filter(timestamp => {
      return timestamp >= from && timestamp <= to;
    });
    let validIndexes = [[]];
    validIndexes[0] = validTimestamps.reduce(
      (a, b) => a.concat(indexes[collection]["event.when"][b]),
      []
    );

    // Loop over each 'where' query and get the record indexes for each criteria
    where.forEach(whereQuery => {
      if (whereQuery.op === "is") {
        validIndexes.push(
          indexes[collection][whereQuery.field][whereQuery.value]
        );
      } else if (whereQuery.op === "is not") {
        let tempIndexes = [];
        Object.keys(indexes[collection][whereQuery.field]).forEach(value => {
          if (value !== whereQuery.value) {
            tempIndexes = tempIndexes.concat(
              indexes[collection][whereQuery.field][value]
            );
          }
        });
        validIndexes.push([...new Set(tempIndexes)]);
      } else if (whereQuery.op === "is one of") {
        let tempIndexes = [];
        whereQuery.values.forEach(value => {
          if (indexes[collection][whereQuery.field][value]) {
            tempIndexes = tempIndexes.concat(
              indexes[collection][whereQuery.field][value]
            );
          }
        });
        validIndexes.push([...new Set(tempIndexes)]);
      } else if (whereQuery.op === "is not one of") {
        let tempIndexes = [];
        Object.keys(indexes[collection][whereQuery.field]).forEach(value => {
          if (!whereQuery.values.includes(value)) {
            tempIndexes = tempIndexes.concat(
              indexes[collection][whereQuery.field][value]
            );
          }
        });
        validIndexes.push([...new Set(tempIndexes)]);
      } else if (whereQuery.op === "is between") {
        const whereQueryValueFrom = parseFloat(whereQuery.values[0]);
        const whereQueryValueTo = parseFloat(whereQuery.values[1]);
        let tempIndexes = [];
        const keys = Object.keys(indexes[collection][whereQuery.field]);
        let i = 0;
        let bottomIndex = -1;
        let topIndex = -1;

        for (const value of keys) {
          if (value >= whereQueryValueFrom) {
            if (bottomIndex === -1) {
              bottomIndex = i;
            }
          }
          if (value > whereQueryValueTo) {
            topIndex = i;
            break;
          }
          i += 1;
        }
        if (topIndex === -1) {
          topIndex = i;
        }
        keys.slice(bottomIndex, topIndex).forEach(key => {
          tempIndexes = tempIndexes.concat(
            indexes[collection][whereQuery.field][key]
          );
        });
        validIndexes.push([...new Set(tempIndexes)]);
      } else if (whereQuery.op === "is not between") {
        const whereQueryValueFrom = parseFloat(whereQuery.values[0]);
        const whereQueryValueTo = parseFloat(whereQuery.values[1]);
        let tempIndexes = [];
        const keys = Object.keys(indexes[collection][whereQuery.field]);
        let i = 0;
        let beforeBottomIndex = -1;
        let beforeTopIndex = -1;
        let afterBottomIndex = -1;

        for (const value of keys) {
          if (value < whereQueryValueFrom && beforeBottomIndex === -1) {
            beforeBottomIndex = i;
          }
          if (value > whereQueryValueFrom && beforeTopIndex === -1) {
            beforeTopIndex = i - 1;
          }
          if (
            beforeTopIndex !== -1 &&
            value > whereQueryValueTo &&
            afterBottomIndex === -1
          ) {
            afterBottomIndex = i;
          }
          i += 1;
        }

        if (beforeTopIndex === -1) {
          beforeTopIndex = i;
        }

        if (beforeBottomIndex !== -1) {
          keys.slice(beforeBottomIndex, beforeTopIndex).forEach(key => {
            tempIndexes = tempIndexes.concat(
              indexes[collection][whereQuery.field][key]
            );
          });
        }
        if (afterBottomIndex !== -1) {
          keys.slice(afterBottomIndex).forEach(key => {
            tempIndexes = tempIndexes.concat(
              indexes[collection][whereQuery.field][key]
            );
          });
        }
        validIndexes.push([...new Set(tempIndexes)]);
      } else if (whereQuery.op === "exists") {
        let tempIndexes = [];
        if (indexes[collection][whereQuery.field]) {
          Object.keys(indexes[collection][whereQuery.field]).forEach(value => {
            tempIndexes = tempIndexes.concat(
              indexes[collection][whereQuery.field][value]
            );
          });
        }
        validIndexes.push([...new Set(tempIndexes)]);
      } else if (whereQuery.op === "does not exist") {
        let tempIndexes = [];
        if (!indexes[collection][whereQuery.field]) {
          Object.keys(indexes[collection]).forEach(field => {
            if (field !== whereQuery.field) {
              Object.keys(indexes[collection][field]).forEach(value => {
                tempIndexes = tempIndexes.concat(
                  indexes[collection][field][value]
                );
              });
            }
          });
        }
        validIndexes.push([...new Set(tempIndexes)]);
      } else if (whereQuery.op === "is less than") {
        const whereQueryValue = parseFloat(whereQuery.value);
        let tempIndexes = [];
        const keys = Object.keys(indexes[collection][whereQuery.field]);
        let i = 0;
        for (const value of keys) {
          if (value > whereQueryValue) {
            keys.slice(0, i - 1).forEach(key => {
              tempIndexes = tempIndexes.concat(
                indexes[collection][whereQuery.field][key]
              );
            });
            break;
          }
          i += 1;
        }
        validIndexes.push([...new Set(tempIndexes)]);
      } else if (whereQuery.op === "is greater than") {
        const whereQueryValue = parseFloat(whereQuery.value);
        let tempIndexes = [];
        const keys = Object.keys(indexes[collection][whereQuery.field]);
        let i = 0;
        for (const value of keys) {
          if (value > whereQueryValue) {
            keys.slice(i).forEach(key => {
              tempIndexes = tempIndexes.concat(
                indexes[collection][whereQuery.field][key]
              );
            });
            break;
          }
          i += 1;
        }
        validIndexes.push([...new Set(tempIndexes)]);
      }
    });

    // Find the intersection of all the matching record indexes, then get the records and return them
    return intersection(...validIndexes).map(index => store[collection][index]);
  }
};

module.exports = api;
