const customSchema = require("./customEventSchema");

const baseSchema = {
  id: "string:forbidden",
  event: {
    action: "string:min=1,max=100,required",
    when: "string:isodate,required"
  },
  service: {
    name: "string:required",
    type: "string:required",
    env: "string:required"
  },
  user: {
    id: "string",
    firstName: "string:min=1,max=100",
    lastName: "string:min=1,max=100",
    email: "string:email",
    phoneNumber: "string:min=5,max=30",
    dateOfBirth: "string:isodate"
  },
  device: {
    id: "string",
    sessionId: "string",
    type: "string",
    screenWidth: "number",
    screenHeight: "number",
    userAgent: "string",
    location: {
      ip: "string:ip",
      geo: {
        lat: "number:min=-90,max=90",
        lng: "number:min-180,max=180"
      }
    }
  },
  interaction: {
    left: "number",
    top: "number",
    selector: "string"
  },
  url: {
    original: "string"
  },
  referringUrl: {
    original: "string"
  },
  externalReferringUrl: {
    original: "string"
  },
  landingUrl: {
    original: "string"
  }
};

module.exports = { ...baseSchema, ...customSchema };
