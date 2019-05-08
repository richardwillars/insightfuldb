const uuid = require("uuid");
const util = require("util");
const readline = require("readline");
const fs = require("fs");
const eventSchema = require("../../eventSchema");
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
  }
};

module.exports = api;
