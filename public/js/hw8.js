/* lat& lng */
var curr_lat, curr_lng;
var search_lat, search_lng;

var keyword = ""; // entered keyword
var category = "default" // default category
var radius = 16093.44 // default distance

var search_params; // Parameters for search nearby places

/* Search results of nearby places, used for pagination. */
var placeList = new Object();
placeList.results = new Array();
placeList.curr = 0;

var localStorageFlag = true;
$(document).ready(function() {
    /* Initialize favourite list. */
    if(typeof(Storage) !== "undefined"){
        localStorage.favList = "";
    }else{
        localStorageFlag = false;
    }

    fetchGeolocation();

    $("#keyword, #address").on('keyup blur', function () {
        checkError(this.id);
    });

    $("#current").click(function () {
        disAddr();
    });
    $("#other").click(function () {
        enblAddr();
    });

    $("#searchForm").submit(function (e) {
        e.preventDefault();
        goSearch();

        /* --- Form progress bar. --- */
        var text = "<div class=\"progress\">" +
            "<div class=\"progress-bar progress-bar-striped progress-bar-animated\" role=\"progressbar\" aria-valuenow=\"75\" aria-valuemin=\"0\" aria-valuemax=\"100\" style=\"width: 50%\"></div>" +
            "</div>";
        $("#results").html(text);
        if($("#favLink").hasClass("btn btn-primary")){
            $("#resLink").toggleClass("btn btn-primary");
            $("#favLink").removeClass("btn btn-primary");
        }
        //return false;
    });


    /* Open Hours dialog. */
    $("#dialog").dialog({
        autoOpen: false,
        title: 'Open hours'
    });

    /* Handle map_from section in place details. */
    $("#results").on("keyup blur", "#map_from", function(){
        if($.trim($("#map_from").val()).length == 0){
            $("#map_from").css("borderColor", "red");
            $("#routeBtn").attr("disabled", true);
        }else{
            $("#map_from").css("borderColor", "#ced4da");
            $("#routeBtn").attr("disabled", false);
        }
    });


    $("#favLink").click(function(){
        showFavList();
        $(this).toggleClass("btn btn-primary");
        $("#resLink").removeClass("btn btn-primary");
    });

    $("#resLink").click(function(){
        $(this).toggleClass("btn btn-primary");
        $("#favLink").removeClass("btn btn-primary");

        showNearbyPlaces(placeList.curr);
    });

    $("#clearBtn").click(function(){
        clearAll();
    });


});

/*
 * 1. Fetch local lat & lng based on IP address.
 * */
var geoFlag = false;
function fetchGeolocation(){
    try{
        $.ajax({
            url: "http://ip-api.com/json",
            type: "GET",
            dataType: "json",
            success: function(data){
                curr_lat= data.lat;
                curr_lng = data.lon;
                geoFlag = true;
            },
            error: function(jqXHR, textStatus, errorThrown){
                alert("AJAX ERROR in fetchGeolocation(): \n" + JSON.stringify(jqXHR));
                curr_lat = "";
                curr_lng = "";
                geoFlag = false; // Search button should be disabled.
                enblSearchBtn();
            }
        });
    }catch(err){
        alert(err);
    }
}

/*
 * 2. Autocomplete function for address field in search form.
 * */
var autocomplete; // variable for address field.
function initAutocompleteInSearchForm() {
    autocomplete = new google.maps.places.Autocomplete((document.getElementById('address')),
            {types: ['geocode'], componentRestrictions: {country: 'us'}});

    autocomplete.addListener('place_changed', getNewLatLng);
}

/*
 * 3. Obtain new lat & lng from the specific place selected by user.
 * */
function getNewLatLng(){
    var place = autocomplete.getPlace();
    search_lat = place.geometry.location.lat();
    search_lng = place.geometry.location.lng();
}

/*
 * 4. Check the user input in keyword & address fields.
 * */
var kwFlag = false;
var addrFlag = true;
function checkError(id){
    var input = document.getElementById(id).value.trim();
    var flag = false;
    if(input.length != 0){
        hideErrMsg(id);
        flag = true;
    }else{
        displayErrMsg(id);
    }
    /* Update the status of search button. */
    if(id == "keyword"){
        kwFlag = flag;
    }else{
        addrFlag = flag;
    }
    enblSearchBtn();
}

/*
 * 5. Show error message when keyword/address is invalid.
 * */
function displayErrMsg(id){
    document.getElementById(id).style.borderColor = "red";
    if(id == "keyword"){
        document.getElementById("err_kw").style.visibility = "visible";
        document.getElementById("err_kw").style.lineHeight = "15px";
    }else{
        document.getElementById("err_addr").style.visibility = "visible";
        document.getElementById("err_addr").style.lineHeight = "15px";
    }
}

/*
 * 6. Hide the error message when user has entered valid input.
 * */
function hideErrMsg(id){
    document.getElementById(id).style.borderColor = "#ced4da";
    if(id == "keyword"){
        document.getElementById("err_kw").style.visibility = "hidden";
        document.getElementById("err_kw").style.lineHeight = "0";
    }else{
        document.getElementById("err_addr").style.visibility = "hidden";
        document.getElementById("err_addr").style.lineHeight = "0";
    }
}

/*
 * 7. Check the status of search button
 * */
function enblSearchBtn(){
    if(geoFlag && kwFlag && addrFlag){
        document.getElementById("searchBtn").disabled = false;
    }else{
        document.getElementById("searchBtn").disabled = true;
    }
}

/*
 * 8. Enable address field when user clicks corresponding radio.
 * */
function enblAddr(){
    document.getElementById("address").disabled = false;
    addrFlag = false;
    enblSearchBtn();

    search_lat = 0;
    search_lng = 0;
}

/*
 * 9. Disable address field when user chooses current location.
 * */
function disAddr(){
    document.getElementById("address").disabled = "true";
    document.getElementById("address").value = "";
    hideErrMsg("address");
    addrFlag = true;
    enblSearchBtn();

    search_lat = 0;
    search_lng = 0;
}


/*
* 10. Form the parameters for search
* i.e. Obtain the lat & lng of the user typed in place.
* */
function goSearch(){
    var wrongAddr = false; // Flag indicating whether system obtains the geo-info.

    keyword = $.trim($("#keyword").val());
    category = $("#category").val();
    /* Obtain radius */
    if($.trim($("#radius").val()).length != 0){
        radius = parseFloat($("#radius").val()) * 1609.344;
    }else{
        radius = 10 * 1609.344;
    }
    /* Find the specific address user typed in(not choose).*/
    var loc = $("input[name='location']:checked").val();
    if(loc != "current"){
        if(search_lat == 0 && search_lng == 0){
            $.ajax({
                url: "/ggGeoFetch",
                type: "GET",
                dataType: "json",
                cache: false,
                async: false,
                data: {
                    "address": $.trim($("#address").val())
                },
                success: function(data) {
                    if (!data.hasOwnProperty("lat")) {
                        document.getElementById("results").innerHTML = "<div class='alert alert-warning' role='alert'>"
                            + "No records.</div>";
                        wrongAddr = true;

                    } else {
                        search_lat = data['lat'];
                        search_lng = data['lng'];
                    }
                },
                error: function(jqXHR, textStatus, errorThrown){
                    alert("AJAX Error: \n" + JSON.stringify(jqXHR));
                }
            });

        }
        if(!wrongAddr){
            search_params = {
                "keyword": keyword,
                "category": category,
                "radius": radius,
                "lat": search_lat,
                "lng": search_lng,
            };
            search();
        }
    }
    else{
        search_params = {
            "keyword": keyword,
            "category": category,
            "radius": radius,
            "lat": curr_lat,
            "lng": curr_lng,
        };
        search();
    }
}

/*
* 11. Do nearby place search.
* */
function search(){
    $.ajax({
        url: "/searchNearby",
        type: "GET",
        dataType: "json",
        data: search_params,
        cache: false,
        success: function(data) {
            if(!data.hasOwnProperty("places")) {
                document.getElementById("results").innerHTML =
                    "<div class='alert alert-warning' role='alert'>No records.</div>";
            }else {
                storePlaces(data, 0);
                showNearbyPlaces(0);
            }
        },
        error: function(jqXHR, textStatus, errorThrown){
            alert("AJAX Error: \n" + JSON.stringify(jqXHR));
            document.getElementById("results").innerHTML = "<div class='alert alert-danger'>Failed to get search results.</div>";
        }
    });
}


/*
* 12. Store the search results into local variable.
* */
function storePlaces(data, num){
    /* Store those places and (optional) next-page-token into <placeList> */
    //placeList.curr = num;
    if(data.hasOwnProperty("nextTkn")){
        placeList.results[num] = {
            places: data["places"],
            nextTkn: data["nextTkn"]
        };
    }else{
        placeList.results[num] = {
            places: data["places"],
            nextTkn: null
        };
    }
}


/*
* 13. display the search results below the search form.
* */
function showNearbyPlaces(num){
    if(placeList.results == null || placeList.results.length == 0){
        return;
    }
    var places = placeList.results[num].places;
    /* Detail button */
    var div_text = "<div class='card-block text-right' style='margin-bottom: 5px'>"
        + "<button type='button' class='btn btn-outline-secondary btn-sm' href='javascript:void(0)' id='detsBtn' onclick='goToDets()' disabled = 'true'>"
        +"Details<span class='fa fa-chevron-right'></span></button></div>";
    /* 1st row of result table */
    div_text += "<div class=\"table-responsive-sm\"><table class='table table-hover table-sm' id='placeTb'><thead><tr><th scope='col'>#</th>"
        + "<th scope='col'>Category</th><th scope='col'>Name</th><th scope='col'>Address</th>"
        + "<th scope='col'>Favorites</th><th scope='col'>Details</th></tr></thead>";
    div_text += "<tbody>";
    /* Display place results.*/
    for(var i = 0; i < places.length; i++){
        if(selectedPlaceId == places[i].place_id){
            div_text += "<tr style='background-color: #FDDE9A;'><th scope='row'>" + (i+1) + "</th>";
        }else{
            div_text += "<tr><th scope='row'>" + (i+1) + "</th>";
        }
        div_text += "<td><img src='" + places[i].icon + "' alt='icon' width=40/></td>";
        div_text += "<td>" + places[i].name + "</td>";
        div_text += "<td>" + places[i].vicinity + "</td>";
        div_text += "<td><button type='button' class='btn btn-outline-secondary btn-sm'"
            + "onclick='addFav(\"" + places[i].icon + "\", \"" + (places[i].name).replace(/'/g, "&#039;") + "\", \"" + places[i].vicinity + "\", \"" + places[i].place_id + "\")'>";

        var found = checkExist(places[i].place_id);
        if(found != null && found.length != 0 && found[0].place_id == places[i].place_id){
            div_text += "<span class='fas fa-star' style='color: #FDD444' id='favBtn_" + places[i].place_id + "'></span>";
        }else{
            div_text += "<span class='far fa-star' id='favBtn_" + places[i].place_id + "'></span>";
        }

        div_text += "</button></td>";

        div_text += "<td><button type='button' class='btn btn-outline-secondary btn-sm' "
            + "id='" + places[i].place_id + "' onclick='getDets(this.id, " + i + ")'>" +
            "<span class='fa fa-chevron-right'></span></button></td></tr>";
    }
    div_text += "</tbody></table></div>";

    /* Next & Previous button */
    if(placeList.results[num].nextTkn != null){
        div_text += "<div class='card-block text-center'>";
        /* Add previous button */
        if(placeList.curr != 0){
            div_text += "<a class='btn btn-outline-secondary btn-sm pageBtn' href='javascript:void(0)' role='button' id='prevBtn' onclick='prevPage()'>Previous</a>&nbsp;"

        }
        /* Add next button */
        div_text += "<a class='btn btn-outline-secondary btn-sm pageBtn' href='javascript:void(0)' role='button' id='nextBtn' onclick='nextPage()'>Next</a>"
            + "</div>";
    }
    /* No next page‘s result */
    else{
        if(num != 0){ /* Add previous button. */
            div_text += "<div class='card-block text-center'>"
                + "<a class='btn btn-outline-secondary btn-sm pageBtn' href='javascript:void(0)' role='button' id='prevBtn' onclick='prevPage()'>Previous</a>"
                + "</div>";
        }
    }
    document.getElementById("results").innerHTML = div_text;


    if(selectedPlaceId != ""){
        document.getElementById("detsBtn").disabled = false; // Enabled detail button.
    }

}

/*
* 14. Turn to next page for search result.
* */
function nextPage(){
    var curr = placeList.curr;
    /* Next page's results has already been fetched. */
    if((curr + 1) <= (placeList.results.length - 1)){
        placeList.curr++;
        showNearbyPlaces(placeList.curr);
    }else{
        $.ajax({
            url: "/nextPage",
            type: "GET",
            dataType: "json",
            data: {
                "token": placeList.results[curr].nextTkn
            },
            cache: false,
            success: function(data){
                storePlaces(data, ++placeList.curr);
                showNearbyPlaces(placeList.curr);
            },
            error: function(jqXHR, textStatus, errorThrown){
                alert("Ajax Error: \n" + JSON.stringify(jqXHR));
            }
        });
    }

}

/*
* 15. Turn to previous page of search result.
* */
function prevPage(){
    showNearbyPlaces(--placeList.curr);
}


/*
* 16. Show place details
* */
var selectedPlaceId = ""; // The place id that selected by user.
function getDets(place_id){
   var service = new google.maps.places.PlacesService(document.createElement('div'));
   service.getDetails({
            "placeId": place_id
   }, function(place, status){
        if(status == google.maps.places.PlacesServiceStatus.OK){ // Successfully fetched place details
            generateDetsTab(place);
        }else{
            document.getElementById("results").innerHTML = "<div class='alert alert-danger'>Failed to get place details.</div>";
        }
   });
   selectedPlaceId = place_id;

}

/*
* 17. Generate info tab.
* */
function generateDetsTab(details){
    var div_text = "";
    div_text = "<div class='card-block text-center' style='font-size:22px'><strong>" + details.name + "</strong></div>";
    div_text += "<div class='inLineBtn'>"
        + "<div><button type='button' class='btn btn-outline-secondary btn-sm' onclick='backToList()'>"
        + "<span class='fa fa-chevron-left'></span>&nbsp;List</button></div>"
        + "<div><button type='button' class='btn btn-outline-secondary btn-sm' "
        + "onclick='addFav(\"" + details.icon + "\", \"" + (details.name).replace(/'/g, "&#039;") + "\", \"" + details.vicinity + "\", \"" + details.place_id +"\")'>";

    var found = checkExist(details.place_id);
    if(found != null && found.length != 0 && found[0].place_id == details.place_id){
        div_text += "<span class='fas fa-star' style='color: #FDD444' id='favBtn_" + details.place_id + "'></span>";
    }else{
        div_text += "<span class='far fa-star' id='favBtn_" + details.place_id + "'></span>";
    }
        + "<span class='far fa-star'></span></button>"
    div_text += "<button class='btn btn-outline-scondary btn-sm' style=\"padding:0; margin-left: 5px;\">"
        + "<a class='twitter-share-button' id='twiBtn'>"
        + "<img src=\"http://cs-server.usc.edu:45678/hw/hw8/images/Twitter.png\" style=\"margin:0; padding:0; height: 32px;\"/>"
        + "</a></button></div></div>";

    /* Content of place details */
    div_text += "<ul class='nav nav-tabs justify-content-end' id='myTab' role='tablist'>"
        + "<li class='nav-item'><a class='nav-link text-center active' id='info-tab' data-toggle='tab' href='#info' role='tab' aria-controls='info' aria-selected='true'>Info</a></li>"
        + "<li class='nav-item'><a class='nav-link text-center' id='photos-tab' data-toggle='tab' href='#photos' role='tab' aria-controls='photos' aria-selected='true'>Photos</a></li>"
        + "<li class='nav-item'><a class='nav-link text-center' id='map-tab' data-toggle='tab' href='#map' role='tab' aria-controls='map' aria-selected='true'>Map</a></li>"
        + "<li class='nav-item'><a class='nav-link text-center' id='rew-tab' data-toggle='tab' href='#rew' role='tab' aria-controls='rew' aria-selected='true'>Reviews</a></li>"
        + "</ul>";

    div_text = getInfo(div_text, details);
    div_text = getPhotos(div_text, details);
    div_text = getMap(div_text, details);
    div_text = getReviews(div_text, details);

    document.getElementById("results").innerHTML = div_text;

    openTwiDlg(details); // Generate daily hours dialog.
    showPlaceRating(); // Display rating stars for each rating.
    drawMap(details); // Generate Map in Map section
    initAutoMapFrom(); // Initial auto-complete of the from field in map section

    showRews(ggReviews); // Generate reviews of a particular place.

    /* Monitor bootstrap-navTab */
    $('a[data-toggle=tab]').each(function(){
        var $this = $(this);

        $this.on('shown.bs.tab',function(){
            var target = $this.attr("href") // Obtain activated tab
            if(target == '#photos'){
                $(".grid").imagesLoaded( function () { // Initialize the masonry after '#photos' tab is activated.
                    $(".grid").masonry({
                        itemSelector: '.grid-item'
                    });
                });
            }
        });
    });
}

/*
* 18. Get Info about this particular place
* */
function getInfo(text, place){
    var replacer = ["formatted_address", "international_phone_number", "price_level", "rating", "url", "website"];
    var jsonStr = JSON.stringify(place, replacer);
    var json = JSON.parse(jsonStr);

    text += "<div class='tab-content' id='myTabContent' style='margin-top: 20px;'>"
        + "<div class='tab-pane fade show active' id='info' role='tabpanel' aria-labelledby='info-tab'>"
        + "<div class=\"table-responsive-sm\"><table class='table table-striped'><tbody>";

    if(json.hasOwnProperty("formatted_address")){
        text += "<tr><th scope='row'>Address</th><td>" + json.formatted_address + "</td></tr>";
    }
    if(json.hasOwnProperty("international_phone_number")){
        text += "<tr><th scope='row'>Phone Number</th><td>" + json.international_phone_number + "</td></tr>";
    }
    if(json.hasOwnProperty("price_level")){
        /* Convert price level to $ notation. */
        var dollar = "";
        for(var i = 0; i < json.price_level; i++){
            dollar += "$";
        }
        text += "<tr><th scope='row'>Price Level</th><td>" + dollar + "</td></tr>";
    }
    if(json.hasOwnProperty("rating")){
        /* Display rating stars. */
        text += "<tr><th scope='row'>Rating</th><td><div id='rtgSection' class='rtg-wrap'><div id='rating' class='rtg-left'>" + json.rating + "</div></div></td></tr>";
    }
    if(json.hasOwnProperty("url")){
        text += "<tr><th scope='row'>Google Page</th><td><a href='" + json.url + "' target='_blank'>" + json.url + "</a></td></tr>";
    }
    if(json.hasOwnProperty("website")){
        text += "<tr><th scope='row'>Website</th><td><a href='" + json.website + "' target='_blank'>" + json.website + "</a></td></tr>";
    }
    if(place.hasOwnProperty("opening_hours")){
        //alert(JSON.stringify(place.opening_hours));
        text += "<tr><th scope='row'>Hours</th><td>";
        if(place.opening_hours.open_now == true){
            text += "Open now: ";
            var now = moment().format("dddd"); // Obtain today's weekday.
            var weekday_text = place.opening_hours.weekday_text;
            var hours = "";
            for (var i = 0; i < weekday_text.length; i++){
                if(weekday_text[i].indexOf(now) == 0){
                    hours = weekday_text[i].substring(now.length + 2);
                    break;
                }
            }
            text += hours;
            //var myday = new Date().getDay();
            //text += place.opening_hours.periods[myday].open.time;
            text += " <a href='javascript:void(0)' style='padding-left:5em' onclick='openHours(\""
                + weekday_text + "\", " + i + ")'>Daily open hours</a>";
        }else{
            text += "Closed";
            var i = (moment().isoWeekday() - 1) % 7; // Obtain num of weekday.
            var weekday_text = place.opening_hours.weekday_text;
            text += " <a href='javascript:void(0)' style='padding-left:5em' onclick='openHours(\""
                + weekday_text + "\", " + i + ")'>Daily open hours</a>";
        }
        text += "</td></tr>";
    }
    text += "</tbody></table></div></div>";

    return text;
}


/*
* 19. Get Photo gallery
* */
function getPhotos(text, place){
    text += "<div class='tab-pane fade' id='photos' role='tabpanel' aria-labelledby='photos-tab'>";
    if(place.hasOwnProperty("photos")){
        text += "<div class='grid'>";
        for(var i = 0; i < place.photos.length; i++){
            text += "<div class='grid-item'><a href='" + place.photos[i].getUrl({'maxWidth': place.photos[i].width})
                + "' target='_blank'><img src='" + place.photos[i].getUrl({'maxWidth': 230}) + "' alt='place_img'/></a></div>";

        }
        text += "</div>";
    }else{
        text += "<div class='alert alert-warning' role='alert'> No Photos.</div>";
    }

    text += "</div>";
    return text;
}

/*
* 20. Get Map information
* */
function getMap(text, place){
    text += "<div class='tab-pane fade' id='map' role='tabpanel' aria-labelledby='map-tab'>";
    /* --- New --- */
    text += "<form><div class='form-row'><div class='form-group col-xs-12 col-sm-4'><label for='map_from'>From</label>"
        + "<input type='address' class='form-control form-control-sm' id='map_from' value='";
    if(document.getElementById("address").value.length != 0){
        text += document.getElementById("address").value;
    }else{
        text += "Your location";
    }

    text += "'></div>";
    text += "<div class='form-group col-xs-12 col-sm-4'><label for='map_to'>To</label>"
        + "<input type='address' class='form-control form-control-sm' id='map_to' value='" + place.name + ", " + place.formatted_address + "' readonly>"
        + "</div>";

    text += "<div class='form-group col-xs-12 col-sm-2'><label for='mode'>Travel Mode</label>"
        + "<select name='mode' id='mode' class='form-control form-control-sm'>"
        + "<option value='DRIVING' selected='selected'>Driving</option>"
        + "<option value='BICYCLING'>Bicycling</option>"
        + "<option value='TRANSIT'>Transit</option>"
        + "<option value='WALKING'>Walking</option>"
        + "</select></div>";

    /* Obtain the lat & lng of the destination. */
    var str = place.geometry.location + "";
    var coords = str.split(",");
    var latitude = coords[0].substring(1);
    var longitude = coords[1].substring(0, coords[1].length - 1 );

    text += "<div class='form-group col-xs-12 col-sm-2'><label for='routeBtn'>&nbsp;</label>"
        + "<button type='button' class='btn btn-primary btn-sm' style='display: block;' id='routeBtn' onclick='calRoute(\"" + latitude + "\", \"" + longitude + "\")'>Get Directions</button></div>";

    text += "</div></form>";

    text += "<div class='row'><a href='javascript:void(0)' onclick='toggleStreetView()'><img src='http://cs-server.usc.edu:45678/hw/hw8/images/Pegman.png' "
            + "alt='streetIcon' id='iconBtn' class='street-icon'/></a></div>";

    text += "<div class='row'><div class='det-map' id='placeMap'></div></div><div class='det-map' id='routePanel'></div>";
    text += "</div>";

    return text;
}


/*
* 21. Draw map in Map section
* */
var panorama; // Panorma object for map.
var directionsService;
var directionDisplay;
var marker;
function drawMap(place){
    /* Obtain the lat & lng of the destination. */
    var str = place.geometry.location + "";
    var coords = str.split(",");
    var latitude = coords[0].substring(1);
    var longitude = coords[1].substring(0, coords[1].length - 1 );

    var centre = {
        lat: parseFloat(latitude),
        lng: parseFloat(longitude)
    };

    var map = new google.maps.Map(document.getElementById("placeMap"), {
        center: centre,
        zoom: 14,
        streetViewControl: false
    });

    marker = new google.maps.Marker({
        position: centre,
        map: map,
        title: 'Destination'
    });

    panorama = map.getStreetView();
    panorama.setPosition(centre);
    panorama.setPov(({
        heading: 265,
        pitch: 5
    }));

    /* Initiate route service */
    directionsService = new google.maps.DirectionsService;
    directionsDisplay = new google.maps.DirectionsRenderer({
        map: map,
        panel: document.getElementById("routePanel")
    });

    /* Set the width and height of map div. */
    document.getElementById("placeMap").style.height = "300px";
    document.getElementById("placeMap").style.width = "97%";
}

/*
* 22. Show Google Street view.
* */
function toggleStreetView(){
    var toggle = panorama.getVisible();
    if(toggle == false){
        panorama.setVisible(true);
        document.getElementById("iconBtn").src = "http://cs-server.usc.edu:45678/hw/hw8/images/Map.png";
    }else{
        panorama.setVisible(false);
        document.getElementById("iconBtn").src = "http://cs-server.usc.edu:45678/hw/hw8/images/Pegman.png";
    }
}

/*
* 23. Calculate Route within Map section of Place detail page.
* */
function calRoute(destLat, destLng){
    var mode = document.getElementById("mode").value.trim();
    var from = document.getElementById("map_from").value.trim();
    var start; // Origin lat & lng
    if(from == "Your location" || from == "My location"){
        start = {lat: curr_lat, lng: curr_lng};
    }else if(from == document.getElementById("address").value.trim()){
        start = {lat: search_lat, lng: search_lng};
    }
    else{
        var addr = (autoMapFrom.getPlace()).formatted_address;
        if(addr != from){
            $.ajax({
                url: "/ggGeoFetch",
                type: "GET",
                dataType: "json",
                cache: false,
                async: false,
                data: {
                    "address": from
                },
                success: function(data) {
                    if (!data.hasOwnProperty("lat")) {
                       // maybe some error message.... but I don't want to handle it.

                    } else {
                        mapFrom_lat = data['lat'];
                        mapFrom_lng = data['lng'];
                        start = {lat: mapFrom_lat, lng: mapFrom_lng};
                    }
                },
                error: function(jqXHR, textStatus, errorThrown){
                    alert("AJAX Error: \n" + JSON.stringify(jqXHR));
                }
            });
        }else{
            start = {lat: mapFrom_lat, lng: mapFrom_lng};
        }
    }
    marker.setMap(null); // Remove original destination marker.

    directionsService.route({
        origin: start,
        destination: {lat: parseFloat(destLat), lng: parseFloat(destLng)},
        travelMode: google.maps.TravelMode[mode],
        provideRouteAlternatives: true
    }, function(response, status){
        if(status == 'OK'){
            directionsDisplay.setDirections(response);
        }else{
            alert("Directions request failed due to " + status);
        }
    });
}

/*
* 24. Get the reviews from google and Yelp.
* */
var ggReviews;
var yelpReviews;
var rewPlace;
function getReviews(text, place){
    ggReviews = place.reviews;
    rewPlace = place;

    text +=  "<div class='tab-pane fade' id='rew' role='tabpanel' aria-labelledby='rew-tab'>"
        + "<div class='row' style='margin-left: 7px;'>"
        + "<div class='dropdown'><button class='btn btn-secondary dropdown-toggle' type='button' id='rewBtn' data-toggle='dropdown' aria-haspopup='true' aria-expanded='false'>"
        + "<span id='rewType'>Google Reviews</span></button>"
        + "<div class='dropdown-menu' aria-labelledby='rewBtn' id='dropdownRew' name='dropdownRew'>"
        + "<a class='dropdown-item' href='javascript:void(0)' id='gg' onclick='changeRewType(this.id)'>Google Reviews</a>"
        + "<a class='dropdown-item' href='javascript:void(0)' id='yelp' onclick='changeRewType(this.id)'>Yelp Reviews</a></div>"
        + "</div>&nbsp;"
        + "<div class='dropdown'><button class='btn btn-secondary dropdown-toggle' type='button' id='sortBtn' data-toggle='dropdown' aria-haspopup='true' aria-expanded='false'>"
        + "<span id='sortType'>Default Order</span></button>"
        + "<div class='dropdown-menu' aria-labelledby='sortBtn' id='dropdownSort' name='dropdownSort'>"
        + "<a class='dropdown-item' href='javascript:void(0)' id='default' onclick='changeRewSeq(this.id)'>Default Order</a>"
        + "<a class='dropdown-item' href='javascript:void(0)' id='high' onclick='changeRewSeq(this.id)'>Highest Rating</a>"
        + "<a class='dropdown-item' href='javascript:void(0)' id='low' onclick='changeRewSeq(this.id)'>Lowest Rating</a>"
        + "<a class='dropdown-item' href='javascript:void(0)' id='recent' onclick='changeRewSeq(this.id)'>Most Recent</a>"
        + "<a class='dropdown-item' href='javascript:void(0)' id='past' onclick='changeRewSeq(this.id)'>Least Recent</a>"
        + "</div>"
        + "</div></div>";


    text += "<div id='reviewSection' style='margin-top: 20px'>";
    text += "</div></div></div>"; // 收tab 以及整个ul-tab
    return text;
}

/*
* 26. Display reviews in reviewSection. [for default mode.]
* */
function showRews(reviews){
    var text = "";
    var sortType = document.getElementById("sortType").innerText;

    if(reviews != null){
        /* Show Review tables. */
        for(var i = 0; i < reviews.length; i++){
            text += "<div class='card reviewCard'><div class='card-body'>"
                + "<table><tr><td rowspan='4' valign='top'><a href='" + reviews[i].author_url + "' target='_blank'><img src='" + reviews[i].profile_photo_url + "' alt='authorImg' width='40'/></a></td>"
                + "<td><a href='" + reviews[i].author_url + "' target='_blank'>" + reviews[i].author_name + "</a></td></tr>";

            text += "<tr><td><div class='rtg-wrap'><div class='rtg-left' id='review_" + i + "' style='margin-top: 3px'>" + reviews[i].rating + "</div><div class='rtg-right' style='color: #9A9A98;'>" + moment.unix(parseInt(reviews[i].time)).format("YYYY-MM-DD HH:mm:ss") + "</div></div></td></tr>";
            text += "<tr><td>" + reviews[i].text + "</td></tr>"
                + "</table>"
                + "</div></div>";
        }
        document.getElementById("reviewSection").innerHTML = text;

        /* Show rating in star mode of review section.*/
        for(var i = 0; i < 5; i++){
            var rewId = "#review_" + i;
            $(rewId).rateYo({
                rating: $(rewId).text(),
                starWidth: "15px",
                readOnly: true
            });
        }
    }else{
        document.getElementById("reviewSection").innerHTML = "<div class='alert alert-warning' role='alert'>No Records.</div>";
    }

}

/*
* 25. Sort reviews in different orders.
* */
function changeRewSeq(id){
    var type = document.getElementById("rewType").innerText;
    var source;
    if(type == 'Google Reviews'){
        source = JSON.parse(JSON.stringify(ggReviews));
    }else{
        source = JSON.parse(JSON.stringify(yelpReviews));
    }
    if(jQuery.isEmptyObject(source)){
        return;
    }
    if(id == 'default'){
        document.getElementById("sortType").innerText = "Default Order";
        if(type == 'Google Reviews'){
            showRews(ggReviews);
        }else{
            showRews(yelpReviews);
        }

    }else if(id == 'high'){
        document.getElementById("sortType").innerText = "Highest Rating";
        source.sort(function(a, b){
            return parseInt(b.rating - a.rating);
        });
        showRews(source);

    }else if(id == 'low'){
        document.getElementById("sortType").innerText = "Lowest Rating";
        source.sort(function(a, b){
            return parseInt(a.rating - b.rating);
        });
        showRews(source);

    }else if(id == 'recent'){
        document.getElementById("sortType").innerText = "Most Recent";
        source.sort(function(a, b){
                return parseInt(b.time - a.time);
        });
        showRews(source);
    }else{
        document.getElementById("sortType").innerText = "Least Recent";
        source.sort(function(a, b){
                return parseInt(a.time - b.time);
        });

        showRews(source);
    }
}

/*
* 26. Switch between yelp and google.
* */
function changeRewType(id){
    if(id == 'gg'){
        document.getElementById("rewType").innerText = "Google Reviews";
        var id = getSortId();
        changeRewSeq(id);
    }else{
        document.getElementById("rewType").innerText = "Yelp Reviews";
        getYelpReviews();
    }
}

/*
* 27. Get Yelp reviews when switch to it.
* */
function getYelpReviews(){
    var params = new Object();
    var address_components = rewPlace.address_components;
    var city, state, country, zip;
    var number = ""; /* details address */
    var street = "";
    for(var i = 0; i < address_components.length; i++){
        if(address_components[i].types[0] == 'locality'){
            city = address_components[i].short_name;
            params['city'] = city;
            continue;
        }
        if(address_components[i].types[0] == 'administrative_area_level_1'){
            state = address_components[i].short_name;
            params['state'] = state;
            continue;
        }
        if(address_components[i].types[0] == 'country'){
            country = address_components[i].short_name;
            params['country'] = country;
            continue;
        }
        if(address_components[i].types[0] == 'street_number'){
            number = address_components[i].long_name;
            continue;
        }
        if(address_components[i].types[0] == 'route'){
            street = address_components[i].long_name;
            continue;
        }
        if(address_components[i].types[0] == 'postal_code'){
            zip = address_components[i].long_name;
            params['zip_code'] = zip;
            continue;
        }
    }

    if(!(number == 0 && street == 0)){
        params['address1'] = number + " " + street;
    }else{
        params['address1'] = "";
    }
    params['name'] = rewPlace.name;
    params['lat'] = rewPlace.geometry.location.lat;
    params['lng'] = rewPlace.geometry.location.lng;

    $.ajax({
        url: "/yelpMatch",
        type: "GET",
        dataType: "json",
        data: params,
        cache: false,
        success: function(data){
            if(jQuery.isEmptyObject(data)){
                document.getElementById("reviewSection").innerHTML = "<div class='alert alert-warning' role='alert'>"
                    + "No Yelp Reviews Found.</div>";
                yelpReviews = null;
            }else{
                normalizeYelpReviews(data);
                //showRews(yelpReviews);
                var id = getSortId();
                changeRewSeq(id);

            }
        },
        error: function(jqXHR, textStatus, errorThrown){
            alert("AJAX ERROR: \n" + JSON.stringify(jqXHR));
            yelpReviews = null;
        }
    });
   // document.getElementById("reviewSection").innerText = text;
}

/*
* 28. Back to List page.
* */
function backToList(){
    if($("#resLink").hasClass("btn btn-primary")){ // If we want to go back to search list.
        showNearbyPlaces(placeList.curr);
    }else{
        showFavList();
    }
}

/*
* 29. Go to details page again.
* */
function goToDets(){
    //var num = selectedRow.substring(selectedRow.lastIndexOf('_') + 1);
    getDets(selectedPlaceId);
}

/*
* 30. Add favourite places.
* */
function addFav(icon, name, vicinity, placeId){
    if(localStorageFlag){
        /* Avoid add favourite place twice. */
        var found = checkExist(placeId);
        if(found != null && found.length != 0 && found[0].place_id == placeId){
            var favList = JSON.parse(localStorage.favList);
            favList= favList.filter(function(data){
                return data.place_id != placeId;
            });

            localStorage.favList = JSON.stringify(favList);

            $("#favBtn_" + placeId).toggleClass('far fa-star');
            $("#favBtn_" + placeId).css("color", "");
            return;
        }

        var favPlace = new Object();
        var list;
        favPlace.icon = icon;
        favPlace.name = name;
        favPlace.vicinity = vicinity;
        favPlace.place_id = placeId;

        if(localStorage.favList.length == 0 || JSON.parse(localStorage.favList).length == 0){
            list = new Array();
        }else{
            list = JSON.parse(localStorage.favList);
        }
        list.push(favPlace);
        localStorage.favList = JSON.stringify(list);

        $("#favBtn_" + placeId).css("color", "#FDD444").toggleClass("fas fa-star");
    }else{
        alert("Sorry, your browser does not support favourite list function...");
    }
}


/*
* 30. Delete favourite place from favourite list.
* */
function delFav(placeId){

    var list = JSON.parse(localStorage.favList);
    list = list.filter(function(data){
        return data.place_id != placeId;
    });

    localStorage.favList = JSON.stringify(list);
    showFavList();
}

/*
* 31. Show Favourite list.
* */
function showFavList(){

    if(localStorage.favList.length == 0 || JSON.parse(localStorage.favList).length == 0){
        document.getElementById("results").innerHTML = "<div class='alert alert-warning' role='alert'>"
            + "No records.</div>";
        return;
    }
    var places = JSON.parse(localStorage.favList);
    /* Detail button */
    var div_text = "<div class='card-block text-right' style='margin-bottom: 5px'>"
        + "<button type='button' class='btn btn-outline-secondary btn-sm' href='javascript:void(0)' id='detsBtn' onclick='goToDets()' disabled = 'true'>"
        +"Details<span class='fa fa-chevron-right'></span></button></div>";
    /* 1st row of result table */
    div_text += "<table class='table table-hover table-sm' id='placeTb'><thead><tr><th scope='col'>#</th>"
        + "<th scope='col'>Category</th><th scope='col'>Name</th><th scope='col'>Address</th>"
        + "<th scope='col'>Favorites</th><th scope='col'>Details</th></tr></thead>";
    div_text += "<tbody>";
    /* Display place results.*/
    for(var i = 0; i < places.length; i++){
        if(selectedPlaceId == places[i].place_id){
            div_text += "<tr style='background-color: #FDDE9A;'><th scope='row'>" + (i+1) + "</th>";
        }else{
            div_text += "<tr><th scope='row'>" + (i+1) + "</th>";
        }
        div_text += "<td><img src='" + places[i].icon + "' alt='icon' width=40/></td>";
        div_text += "<td>" + places[i].name + "</td>";
        div_text += "<td>" + places[i].vicinity + "</td>";
        div_text += "<td><button type='button' class='btn btn-outline-secondary btn-sm'"
            + "onclick='delFav(\"" + places[i].place_id + "\")'>"
            + "<span class='far fa-trash-alt' id='favBtn_" + places[i].place_id + "'></span></button></td>";
        div_text += "<td><button type='button' class='btn btn-outline-secondary btn-sm' "
            + "id='" + places[i].place_id + "' onclick='getDets(this.id, " + i + ")'>" +
            "<span class='fa fa-chevron-right'></span></button></td></tr>";
    }
    div_text += "</tbody></table>";

    /* Next & Previous button */

    document.getElementById("results").innerHTML = div_text;

    if(selectedPlaceId != ""){
        document.getElementById("detsBtn").disabled = false; // Enabled detail button.
    }

}

/*
* 17.5. Show stars of rating in info section.
* */
function showPlaceRating(){
    $( "#rtgSection" ).append( "<div id='rateYo' class='rtg-right' style='margin-top: 3px'></div>" );
    $("#rateYo").rateYo({
        rating: $("#rating").text(),
        starWidth: "15px",
        readOnly: true
    });
}

/*
* 18. Open the dialog for open hours.
* */
function openHours(weekday_text, num){
    var weekday = weekday_text.split(",");

    var text = "<table class='table table-sm'><tbody>";
    var count = 0;
    var i = num;
    while(count < 7){
        var idx = weekday[i].indexOf(":");
        if(i == num){
            text += "<tr><th scope='row'>" + weekday[i].substring(0, idx) + "</th><th>" + weekday[i].substring(idx + 1) + "</th></tr>";
        }else{
            text += "<tr><td scope='row'>" + weekday[i].substring(0, idx) + "</td><td>" + weekday[i].substring(idx + 1) + "</td></tr>";
        }
        if(i == weekday.length - 1){
            i = 0;
        }else{
            i++;
        }
        count++;
    }

    text += "</tbody></table>";

    text += "<hr /><button class='btn btn-secondary' id='closeBtn' style='float:right;'>Close</button>";

    $("#dialogText").html(text);
    $("#dialog").dialog({
        width: '30%',
    });
    /*  Close function for */
    $("#closeBtn").click(function(){
        $("#dialog").dialog('close');
    });

    $("#dialog").dialog('open');




}

/*
* 24. Initialize Auto-complete of Map_from field.
* */
var autoMapFrom; // Auto-complete for map_from field in Place detail section
function initAutoMapFrom(){
    autoMapFrom = new google.maps.places.Autocomplete((document.getElementById('map_from')),
        {types: ['geocode'], componentRestrictions: {country: 'us'}});
    autoMapFrom.addListener('place_changed', getMapLatLng);
}

/*
* 25. Get new Lat & Lng of the specific
* */
var mapFrom_lat = 0;
var mapFrom_lng = 0;
function getMapLatLng(){
    var place = autoMapFrom.getPlace();
    mapFrom_lat = place.geometry.location.lat();
    mapFrom_lng = place.geometry.location.lng();
}


/*
* 26. Normalize Yelp reviews.
* */
function normalizeYelpReviews(data) {
    var reviews = new Array();
    for (var i = 0; i < data.length; i++) {
        var review = new Object();
        review.author_url = data[i].url;
        review.profile_photo_url = data[i].user.image_url;
        review.author_name = data[i].user.name;
        review.time = moment(data[i].time_created, "YYYY-MM-DD HH:mm:ss").unix();
        review.rating = data[i].rating;
        review.text = data[i].text;

        reviews.push(review);
    }

    yelpReviews = reviews;

}

/*
* 27. Get Sort Id
* */
function getSortId(){
    var innerText = document.getElementById("sortType").innerText;
    if(innerText == "Default Order"){
        return 'default';
    }else if(innerText == "Highest Rating"){
        return 'high';
    }else if(innerText == 'Lowest Rating'){
        return 'low';
    }else if(innerText == 'Most Recent'){
        return 'recent';
    }else {
        return 'past';
    }
}

/*
* 32. Check whether this place has been added to the favourite list.
* */
function checkExist(id){

    if(localStorage.favList.length == 0 || JSON.parse(localStorage.favList).length == 0){
        return null;
    }else{
        return (JSON.parse(localStorage.favList)).filter(function (data) {
            return data.place_id == id;
        });
    }
}

/*
* 33. Open twitter dialog
* */
function openTwiDlg(place){
    $("#twiBtn").click(function(e){
        e.preventDefault();
        var url = "";
        if(place.hasOwnProperty('website')){
            url = place.website;
        }else{
            url = place.url;
        }
        var href = "https://twitter.com/share?"  + "text=Check%20out%20" + encodeURIComponent(place.name) + "%20located%20at%20" + encodeURIComponent(place.formatted_address)
                    + ".%20Website:&url=" + url +  "&hashtags=" + encodeURIComponent("TravelAndEntertainmentSearch");

        var screenWidth = (screen.width - 550) / 2;
        var screenHeight = (screen.height - 285) / 2;
        window.open(href, "Twitter", "resizable = 1, height = 285, width = 550, top=" + screenHeight + ", left = " + screenWidth);
    });

}


function clearAll(){
    /* --- Reset Form to the initial state. --- */
    $("#keyword, #radius").val('');
    $("#category").val('default');

    $("#current").prop('checked', true);
    $("#address").prop('disabled', true);
    $("#address").val("");

    /* --- Reset error msg --- */
    $("#keyword, #address").css("borderColor", "#ced4da");
    $("#err_kw, #err_addr").css({"visibility": "hidden", "lineHeight": "0"});

    $("#results").html("");
    if($("#favLink").hasClass("btn btn-primary")){
        $("#resLink").toggleClass("btn btn-primary");
        $("#favLink").removeClass("btn btn-primary");
    }

    /* --- Clear all local variables. --- */
    search_lat = ""; // Lat & lng of specific address
    search_lng = "";

    $("#searchBtn").attr("disabled", "true"); // Disabled search button and original settings.
    kwFlag = false;
    addrFlag = true;

    search_params.length = 0;
    placeList.results.length = 0;
    placeList.curr = 0;

    selectedPlaceId = "";

    mapFrom_lat = 0;
    mapFrom_lng = 0;
}