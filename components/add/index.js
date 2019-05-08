const builder = require("joi-json").builder();
const Joi = require("joi");
const fs = require("fs");
const util = require("util");
const { insertEvent } = require("../store");
const eventSchema = require("../../eventSchema");

const appendFile = util.promisify(fs.appendFile);

let joiEventSchema = builder.build(eventSchema);

const validateEvents = async body => {
  let events = body;
  // we accept both arrays of events and single events. If it's a single event, put it in an array
  if (!Array.isArray(body)) {
    events = [body];
  }

  // for each event, validate it
  for (const event of events) {
    const result = Joi.validate(event, joiEventSchema);
    if (result.error) {
      await appendFile(
        "./data/rejected-events.json",
        `${result.error.message} - ${JSON.stringify(result.value)}\n`
      );
      continue;
    }
    await insertEvent(result.value);
  }
};

module.exports = async (req, res) => {
  await validateEvents(req.body);

  res.json();
};
