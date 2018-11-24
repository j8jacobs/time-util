/**
 * Trivial example of how this guy can be used
 */
const express = require('express');
const app = express();
const timeUtil = require('../timeUtil.js');


// status code to send back to bad requests
const BAD_REQUEST = 400;

const allArgs = (req, res, next) => {
  // check for the offset header
  const offset = req.get('UTC-Offset'); 
  if(!offset) {
    return res.status(BAD_REQUEST).send({ msg: 'Please send offset in the request header' });
  }

  // make sure the request give the correct input args
  const EXPECTED_ARGS = {
    '/whatTime': ['myTime']
  }
  // extract the URL from the query params so you can validate args
  const endpoint = req.url.split('?')[0];
  const missingArgs = EXPECTED_ARGS[endpoint].filter(argName => !req.query.hasOwnProperty(argName));
  const areAnyMissingArgs = missingArgs.length;
  if (areAnyMissingArgs) {
    return res.status(BAD_REQUEST).send({ msg: 'Not all args sent' });
  }

  // otherwise request was successful and move onto the next middleware layer or to the actual endpoint handler
  next(); 
}

const datetimeValidator = (req, res, next) => {
  // i know this guy us going to be there, because he came from allArgs
  const offset = req.get('UTC-Offset');
  // make sure it comes in the write format though 
  // TODO: incluide regex to validate the structure of the string, then validate the 
  // numbers being passed in are numbers or something

  // extract the passed in arg
  const { myTime } = req.query;
  // get it's time into the UTC format you're looking for
  const myTimeInUTC = timeUtil.toUTC(myTime, offset);
  // stick it back into the req object and move the object forward - now subsequent requests can utilize
  // the transformed values
  req.query = {
    ...req.query, // this will copy all the contents into the object
    myTime: myTimeInUTC // now we've overwritten the myTime portion of the req.query object
  };

  // move the function along to the next middlware or endpoint function handler
  next(); 
}

const endpointHandler = (req, res) => {
  console.log('The transformed value is: ', req.query.myTime );
  const SUCCESS = 200;
  res.status(SUCCESS).send({ msg: `The data was transformed into: ${req.query.myTime}` });
}





//---- START HERE: this is where the actual server magic happens
// this is me being over explicit for the exmaple's sake
// set up a set of functions to be run before the main function get's called for the endpoint: middleware
const middlewareLayers = [allArgs, datetimeValidator];
// what is the actual endpoint that will invoke this sequence of function calls? 
const endpoint = '/whatTime'
// actually connect the server to listen for the GET request at /whatTime endpoint
app.get(endpoint, middlewareLayers, endpointHandler);