'use strict';

var express = require('express');
var app = express();
var path = require('path');
var request = require('request');
const bodyParser = require('body-parser');

const googleApiKey = "AIzaSyCONCCgWhdXLZNb2TAaDZ9NKp1t1Y7AMpM";

const yelp = require('yelp-fusion');
const apiKey = "e1erDwfsIV1BWANvuQg8pOY7dudh2FgpY--L55419tjtgc0GicNlCsybIxsz5XEPdxRu8M-3L8ziOOuNLCQAmVoEStogG-BAyeQBW0O8ej8cAx90J_0InjOTaujOWnYx";
const client = yelp.client(apiKey);

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
/* Show homepage */
app.get('/', function(req, res){});

/* Obtain Geo location through Google API.*/
app.get('/ggGeoFetch', function(req, res){
	var address = req.query.address;
	var geoURL = "https://maps.googleapis.com/maps/api/geocode/json?address=";
	var addr = address.replace(/ /g, "+");
	geoURL += addr + "&language=en&key=" + googleApiKey;

	request(geoURL, function(error, response, data){
		var jsonObj = new Object();	
		if(error)
			console.log(error);
		else{
			var results = JSON.parse(data);
			jsonObj["lat"] = results["results"][0]["geometry"]["location"]["lat"];
			jsonObj["lng"] = results["results"][0]["geometry"]["location"]["lng"];	
		}
		res.end(JSON.stringify(jsonObj));
	});
});

/* Send HTTP request to [Google Places API Nearby Search] */
app.get('/searchNearby', function(req, res){
	var keyword = (req.query.keyword).replace(/ /g, "+");
	var category = req.query.category;
	var radius = req.query.radius;
	var lat = req.query.lat;
	var lng = req.query.lng;

	var url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=";
	if(category == "default"){
	    url += lat + "," + lng + "&radius=" + radius + "&keyword=" + keyword + "&language=en&key=" + googleApiKey;
    }else{
        url += lat + "," + lng + "&radius=" + radius
            + "&type=" + category + "&keyword=" + keyword + "&language=en&key=" + googleApiKey;
    }
	request(url, function(error, response, data){
		if(error){
			console.log("error fetching nearby places...");
			res.end(JSON.parse(new Object()));
		}else{
			var places = new Object();
			var nearby = JSON.parse(data);
			if(nearby["results"].length != 0){
			    var jsonStr = JSON.stringify(nearby["results"], ["icon", "name", "place_id", "vicinity"]);
			    places["places"] = JSON.parse(jsonStr);
			    /* Add next page token if more results are found */
                if(nearby.hasOwnProperty("next_page_token")){
                    places["nextTkn"] = nearby["next_page_token"];
                }
			}
            res.end(JSON.stringify(places));
		}
	});	
});

/* Obtain the next page's result from nearby search.*/
app.get("/nextPage",function(req, res){
	var url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=";
	url += req.query.token + "&language=en&key=" + googleApiKey;

	request(url, function(error, response, data){
		if(error){
			console.log("error fetching next page's nearby places...");
			res.end(error);
		}else{
			var places = new Object();
			var nearby = JSON.parse(data);
			if(nearby["results"].length == 0){
				res.end(JSON.stringify(places));
			}else{
				var jsonStr = JSON.stringify(nearby["results"], ["icon", "name", "place_id", "vicinity"]); 
				places["places"] = JSON.parse(jsonStr);
				/* Add next page token if more results are found */
				if(nearby.hasOwnProperty("next_page_token")){
					places["nextTkn"] = nearby["next_page_token"];
				}
				res.end(JSON.stringify(places));
			}
		}
	});

});

/* Find Yelp business id.*/
app.get("/yelpMatch" ,function(req, res){
	var searchRequest = {
		name: req.query.name,
        address1: req.query.address1,
		city: req.query.city,
		state: req.query.state,
		country: req.query.country,
        zip: req.query.zip_code,
    };

	client.businessMatch('best',searchRequest).then(response => {
        var businessId = "";
  		var place = new Object();
        if(response.jsonBody.businesses.length != 0){
            /* Check weather it is a match. */
            businessId = checkPlaceMatch(req, response.jsonBody.businesses);
            if(businessId != 0){
                /* Obtain Yelp Reviews based on bussiness_id. */
                client.reviews(businessId).then(resp => {
                    if(resp.jsonBody.reviews.length != 0){
                        res.end(JSON.stringify(resp.jsonBody.reviews));
                    }else{
                        res.end(JSON.stringify(new Object()));
                    }

                }).catch(ex => {
                    console.log(ex);
                });
            }else{
                res.end(JSON.stringify(place)); // Return empty object
            }
  		}else{
  			res.end(JSON.stringify(place)); // Return empty object 
  		}
	}).catch(e => {
  		console.log(e);
	});

});


app.listen(8080, function(){
	console.log('Server running at port 8080...');
});


function checkPlaceMatch(req, buss){
    var place = new Object();
    for(var i = 0; i < buss.length; i++){
        place = buss[i];

        if(Math.abs(place.coordinates.latitude - req.query.lat) <= 0.001 &&
            Math.abs(place.coordinates.longitude - req.query.lng) <= 0.001){

            return buss[i].id;
        }
    }
    return 0;
}


