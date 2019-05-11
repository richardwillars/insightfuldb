const req = {
  collection: "events",
  type: "chart",
  from: "2019-01-01T00:00:00.000Z",
  to: "2019-02-08T23:59:59.999Z",
  x: {
    type: "histogram",
    field: "timeTakenToCompleteQuote",
    interval: "auto",
    minimumInterval: 10
  },
  y: {
    agg: "count"
  }
};

const req = {
  collection: "events",
  type: "chart",
  from: "2019-01-01T00:00:00.000Z",
  to: "2019-02-08T23:59:59.999Z",
  x: {
    type: "histogram",
    field: "timeTakenToCompleteQuote",
    interval: "auto",
    minimumInterval: 10
  },
  y: {
    agg: "average",
    field: "timeTakenToAddPetAge"
  }
};

const req = {
  collection: "events",
  type: "chart",
  from: "2019-01-01T00:00:00.000Z",
  to: "2019-02-08T23:59:59.999Z",
  x: {
    type: "dateHistogram",
    field: "ts",
    interval: "auto"
  },
  y: {
    agg: "average",
    field: "timeTakenToAddPetAge"
  }
};

const req = {
  collection: "events",
  type: "chart",
  from: "2019-01-01T00:00:00.000Z",
  to: "2019-02-08T23:59:59.999Z",
  x: {
    type: "terms",
    field: "os",
    size: 5,
    order: "desc"
  },
  y: {
    agg: "median",
    field: "timeTakenToCompleteQuote"
  }
};

const req = {
  collection: "events",
  type: "chart",
  from: "2019-01-01T00:00:00.000Z",
  to: "2019-02-30T23:59:59.999Z",
  x: {
    type: "significantTerms",
    field: "os",
    size: 10
  },
  y: {
    agg: "count"
  }
};

const req = {
  collection: "events",
  type: "chart",
  from: "2019-01-01T00:00:00.000Z",
  to: "2019-02-08T23:59:59.999Z",
  x: {
    type: "dateHistogram",
    field: "ts",
    interval: "auto",
    minimumInterval: 10,
    split: {
      agg: "terms",
      field: "browser",
      orderBy: "_count",
      order: "desc",
      size: 100
    }
  },
  y: {
    agg: "count"
  }
};
const req = {
  collection: "events",
  type: "chart",
  from: "2019-01-01T00:00:00.000Z",
  to: "2019-02-08T23:59:59.999Z",
  x: {
    type: "dateHistogram",
    field: "ts",
    interval: "auto",
    split: {
      agg: "terms",
      field: "browser",
      orderBy: "_term",
      order: "desc",
      size: 5
    }
  },
  y: {
    agg: "median",
    field: "timeTakenToCompleteQuote"
  },
  where: [
    {
      field: "gotTo",
      op: "is not one of",
      // value: "basket",
      values: ["eventstarted", "petName"]
    }
  ]
};

const req = {
  collection: "events",
  type: "chart",
  from: "2019-01-01T00:00:00.000Z",
  to: "2019-02-08T23:59:59.999Z",
  x: {
    type: "histogram",
    field: "timeTakenToCompleteQuote",
    interval: "auto",
    minimumInterval: 10
  },
  y: {
    agg: "median",
    field: "timeTakenToCompleteQuote"
  }
};

const req = {
  collection: "events",
  type: "list",
  from: "2019-01-01T00:00:00.000Z",
  to: "2019-02-08T23:59:59.999Z",
  limit: 2,
  where: [
    {
      field: "gotTo",
      op: "is not one of",
      // value: "basket",
      values: ["eventstarted", "petName"]
    }
  ]
};

const req = {
  collection: "events",
  type: "chart",
  from: "2019-01-01T00:00:00.000Z",
  to: "2019-02-08T23:59:59.999Z",
  x: {
    type: "terms",
    field: "gotTo",
    placeholders: [
      "petName",
      "petType",
      "petGender",
      "petAge",
      "petBreed",
      "petAddress",
      "petFetching",
      "medicalCoverage",
      "excessAmount",
      "startDate",
      "basket",
      "declaration",
      "paymentDetails",
      "purchased"
    ]
  },
  y: {
    agg: "count"
  }
};
