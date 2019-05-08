module.exports = {
  id: "string:forbidden",
  event: {
    action: "string:min=1,max=100,required",
    when: "string:isodate,required"
  },
  service: {
    name: "string:required",
    type: "string:required"
  },
  user: {
    id: "string",
    firstName: "string:min=1,max=100",
    lastName: "string:min=1,max=100",
    email: "string:email"
  },
  device: {
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
  }
};
