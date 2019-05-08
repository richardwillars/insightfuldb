# InsightfulDB

> A no-nonense real-time analytics database written in Node.js that takes events from all over your application and allows you perform complex analytic queries in a very simple fashion.

[![License](http://img.shields.io/:license-mit-blue.svg?style=flat-square)](http://badges.mit-license.org)

> At the moment this is a very-early proof of concept database. Ideas, concepts etc are documented below, and any contribution is welcome. This is a very opionionated concept for how an analytics database could / should work, so any ideas/support would be fanastic.

---

## A brief history

> Whilst working at [Waggel](https://www.waggel.co.uk) we quickly outgrew the possibilities of what Google Analytics could do, and after exploring other options I ended up building an analytics system using ElasticSearch. This was based on a technique detailed in a presentation by Mark Harwood from Elastic called '[Entity-centric indexes](https://www.elastic.co/videos/entity-centric-indexing-mark-harwood)', where you take a series of events and by playing through them in the correct order you build 'entities' based on what happened (similar to how things happen in the real world). This works really well with ElasticSearch in that you can process each event as it gets inserted into the database, and you get computed 'entities' which are then ready to perform aggregations on.

> The problem with that solution is that it is a solution that has multiple moving parts.. you have a queue to stream logs to the database (something like Amazon Kinesis), the ElasticSearch database itself, and then a self-written/maintained script that processes events as they happen and builds the entities. I found that as I was building my application and sending events to ElasticSearch, I ended up spending a lot of time also maintaining the processing script, which was time consuming and liable to issues. It also meant that every time I made a change to the processing script I had to wipe all the entities and replay all the events, which would take a long time!

> ElasticSearch is a fantastic database but it is almost too powerful for the needs of analytics. As with most databases they are designed to be generic solutions that handle a variety of use-cases. My idea is to build a database that is stores, processes and queries analytics data in a very opioniated way. For this reason it can be a LOT simpler than how other databases are built, more intelligent and easier to setup / maintain.

## The idea

> Events can come from all over your business. They might come from different systems, have completely different purposes and because of this the format of the events can vary widely. The first idea is to standardise this data as much as possible. By doing this it'll allow us to make the database a lot more intelligent as it will be able to understand relationships between different events.

> Events will be able to added to the database through an HTTP endpoint, and they should be in JSON format.

E.g.

```
[{
  "event": {
    "action": "userRegistered",
    "when": "2019-05-05T11:27:03.000Z"
  },
  "service": {
    "name": "users-api",
    "type": "api"
  },
  "user": {
     "id": 123,
     "firstName": "John",
     "lastName": "Smith",
     "email": "john@foobar.com"
  }
},
{
  "event": {
    "action": "userLoggedIn",
    "when": "2019-05-05T14:22:32.000Z"
  },
  "service": {
    "name": "users-api",
    "type": "api"
  },
  "user": {
     "id": 123
  },
  "location": {
    "ip": "123.123.123.123",
    "geo": {
      "lat": 52.123,
      "lng": -1.234
    }
  }
}]
```

In the example above you can see two events, one is fired when a user registers and one when a user logs in. You can already see that the events are linked through the user ID, and this events might be used to build an 'user' entity which could look something like this:

```
{
  "createdAt": "2019-05-05T11:27:03.000Z"
  "user": {
    "id": 123,
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@foobar.com",
    "registered": {
      "when": "2019-05-05T11:27:03.000Z"
    },
    "lastLoggedIn": {
      "when": "2019-05-05T14:22:32.000Z",
      "location": {
        "ip": "123.123.123.123",
        "city": "London"
        "geo": {
          "lat": 52.123,
          "lng": -1.234
        }
      }
    }
  }
}
```

Once we have populated some entities we can start to perform analytic queries and aggregations on them.
E.g.

- Count all the users who registered in the last year
- Count all the users who registered but never logged in
- Find all the users who logged in from London
- Find all the users who logged in within 5 miles of a specific lat/lng
- Count all the users grouped by the month of when they registered
- Count all the users grouped by the city where they last logged in
- Count the number of logins grouped on an hourly basis

With all the entities being structured in a consistent fashion means the database is able to understand meaning of certain fields, and also understand how different entities link to each other. For example, the user entity shown above has a user id, and if you had another entity called 'purchases', with a user id in it, the database can create a relationship between the two. This will be achieved by building a graph of relationships, and allow more advanced queries.

E.g.

- Find all users who purchased 2 or more products
- Find all users who purchased a specific product
- Find all users who bought the same 3 products, and get a list of other products that they purchased at the same time (recommendation search)
- Get a list of all products where users who logged in and purchased the product within 5 minutes (potential impulse buy)

## How it'll work

The proof of concept will be written in Node.js with Typescript, but Node.js may not be the best platform just because it's not great at heavy CPU tasks. If the proof of concept goes well and we want to turn this into a real solution then one idea I had is to port everything to Deno which has much higher performance, but we could also look at other scripting languages such as Rust.

My plan so far is to break the database into different responsibilities:

- Ingestion & processing of events
- Storing data
- Querying data
- UI to manage everything (probably written in React)
  - Interface to define how events should be structured
  - Interface to define how events should build up an entity
  - DevOps dashboard to see database performance and modify settings
  - Maybe a Kibana style tool to allow querying the database and produce charts

## Tests

> Tests will be written in Jest and Typescript

---

## License

[![License](http://img.shields.io/:license-mit-blue.svg?style=flat-square)](http://badges.mit-license.org)

- **[MIT license](http://opensource.org/licenses/mit-license.php)**
