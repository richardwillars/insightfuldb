module.exports = {
  pet: {
    id: "number:min=1",
    name: "string",
    type: "string",
    age: "number:min=0",
    gender: "string",
    breedId: "number:min=0",
    breedName: "string"
  },
  policy: {
    id: "string",
    medicalCoverage: "number:min=1",
    claimContribution: "number:min=1",
    basePrice: "number:min=0.01",
    startDate: "string:isodate",
    endDate: "string:isodate",
    price: "number:min=0.01",
    policyVersion: "number:min=1",
    autoRenew: "boolean"
  }
};
