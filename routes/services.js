var express = require('express');
var router = express.Router();

const redis = require('redis');
const PORT = process.env.REDIS_PORT;
const HOST = process.env.REDIS_IP;

const client = redis.createClient(PORT, HOST);
const connection = new Promise((resolve, reject) => {
  const client = redis.createClient(PORT, HOST);

  client.on('connect', () => {
    resolve(client);
  });

  client.on('error', (err) => {
    console.log('An error occurred while connecting to the config store:');
    console.error(err);
    console.log('\n');
  });
})

const serviceAlreadyExists = new Promise((resolve, reject) => {
	(client, service) => {
		client.hget('service-hosts', service, (err, existingService) => {
			resolve(existingService);
		});
	}
});

// GET all service hosts
router.get('/', function(req, res, next) {
  connection.then((client) => {
    client.hgetall('service-hosts', (err, services) => {
    	res.send(services);
    });
  })
  .catch(e => console.log('An error occurred: ', e));
});

// GET single service host
router.get('/:service', function(req, res, next) {
  connection.then((client) => {
    client.hget('service-hosts', req.params["service"], (err, service) => {
    	res.send(service);
    });
  })
  .catch(e => console.log('An error occurred: ', e));
});

// POST new service host
router.post('/', function(req, res, next) {
	const name = req.body["name"];
	const address = req.body["address"];
	const password = req.body["password"];

	if (!(name && address && password)) {
		res.status(422).send("Request body must include a unique service name, an address, and a password.");
	}

	connection.then((client) => {
		serviceAlreadyExists
		.then(existingService => {
			console.log(existingService);

			if (existingService) {
				res.status(403).send(`The service ${name} already exists`);
			}
		})
		.catch(e => console.log(e))
		.then(_ => {
			const redisKey = `${req.params["reqService"]}:${req.params["resService"]}`;
			const args = [];

			for (key in req.body) {
				args.push(key);
				args.push(req.body[key]);
			}

	    client.hset('service-hosts', name, address, (err, redisAddressResponse) => {
	      client.hset('service-credentials', name, password, (err, redisPasswordResponse) => {
	      	res.status(201).send(`New service ${name} created.`);
	      })
	    });
		})
		.catch(e => console.log(e));
  })
  .catch(e => console.log('An error occurred: ', e));
});

// GET config for requesting/responding service combination
router.get('/:reqService/:resService', function(req, res, next) {
	connection.then((client) => {
    client.hgetall(`${req.params["reqService"]}:${req.params["resService"]}`, (err, config) => {
      res.send(config);
    });
  })
  .catch(e => console.log('An error occurred: ', e));
});

// POST config for requesting/responding service combination
router.post('/:reqService/:resService', function(req, res, next) {
	connection.then((client) => {
		const redisKey = `${req.params["reqService"]}:${req.params["resService"]}`;
		const args = [];

		for (key in req.body) {
			args.push(key);
			args.push(req.body[key]);
		}

    client.hmset(redisKey, args, (err, redisResponse) => {
      res.send(redisResponse);
    });
  })
  .catch(e => console.log('An error occurred: ', e));
});

module.exports = router;
