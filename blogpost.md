# Step by Step: From Reactive Programming to Functional Reactive Programming

The goal of this blogpost is to implement the same application using two different 
programming techniques; Reactive Programming and Functional Reactive Programming (FRP). 
And then compare some key differences between the two techniques.

Reactive Programming should be familiar to anyone who has done javascript, either in the 
browser or on the server in the form of Node.js. FRP, on the other hand, might be unfamiliar 
to most of you, so I recommend reading [Making a Collaborative Piano Using Functional 
Reactive Programming](open.bekk.no/making-a-collaborative-piano-using-functional-reactive-programming-frp) as it is a good introduction to the concept.

I will go through the implementation step by step for both techniques and a demo of the 
application is available [here](http://frp-sbs.herokuapp.com). I suggest taking it for a 
spin now and keep it around for reference as we go through the implementation details.

## The Application
But before we get down to business, we will need to define our application. The application 
used for the comparison will be a simple record (the vinyl kind, not the data kind) 
collection It will list out records in the collection and allow the user to add new records. 
To ensure consistency in the collection, the application will only allow unique records and 
valid data.

To achieve this functionality, there are a few things we need to implement:

- Fetching records from a server
- Listing records in the collection
- A way to filter the viewed records
- Adding a new record to the collection
- Informing the user wether the data entered is valid
- Sending the new record to the server for verification
- Receiving the new record or an error from the server
- Adding the new record to the viewed collection

This looks like a fairly simple task. Lets implement it using the familiar jQuery liberary. 
To make the implementation more in line with current best practices in frontend JavaScript 
code, lets add some functional programming from the LoDash liberary.

## The Reactive Programming Implementation

First thing we need is to fetch the record collection from the server when we load the page. 
We can do this using the excellent promise-based AJAX API in jQuery:

```javascript
    var records = [];

    $.ajax("/records")
        .done(function(data) {
            records = data;
            renderRecords(records);
        })
        .fail(function() {
            $("#records .error").toggle(true);
        })
        .always(function() {
            $("#records .loader").toggle(false);
        });
```

This is familiar stuff to anyone that has done any AJAX-requests in the browser and the 
promises interface makes it very clean. If the request succeeds, we set the data 
received to be the current record collection and render it. If the request fails to 
get the record collection from the server, we show an error-message. Regardless of 
wether the request succeed or fail, we hide the spinner that indicates a pending 
request.

To render the record collection we reduce the records to a string of markup and insert 
it into the DOM:

```javascript
    var renderRecords = function(records) {
        var items = _.reduce(records, function(acc, record) {
            return acc + "<li>" +
                "<h3>" + record.album + "</h3>" +
                "<p>Artist: " + record.artist + "</p>" +
                "<p>Year: " + record.year + "</p>" +
                "<p>Genre: " + record.genre + "</p>" +
                "</li>";
        }, "");
        $("#records ul").html(items);
    };
```

We can already see a trend in the way values are assigned to elements in the application, 
always as a reaction to something occuring. We set the visibility of the error-message and 
spinner and the value of the record collection based on how the AJAX-request goes. 
This is reactive programming. Things happening as a response to something.

We continue with the input for the filter we want to apply to our record collection:
```javascript
    var testRegex = function(pattern) {
        return function(value) {
            if(!value) return false;
            return new RegExp(pattern, "i").test(value);
        };
    };

    var filterRecords = function(filter) {
        return _.filter(records, function(record) {
            return _(record).values().any(testRegex(filter));
        });
    };

    $("#filter").on("keyup", function() {
        var filter = $(this).val();
        renderRecords(filterRecords(filter));
    });
```
With two helper functions to filter out which records match the query and an event-listener 
to collect the value to filter for, we get a nice little search functionality for our record 
collection. If the `filterRecords` function look a bit unfamiliar to you I suggest checking 
out the [LoDash documentation](http://lodash.com/docs). Again we see the same pattern, 
the contents of the list displaying the records change as a reaction to the events triggered.

We now have the ability to view and filter the records in the collection received from the 
server. But we also want to be able to add new records into the collection. To make the 
example a little bit more interesting, and maybe more user-friendly, we will use icons to 
indicate the validity of the values entered into the form. Each value required will have 
three states; missing, invalid and valid. And to add a bit of enforcement to the validitiy, 
the application will not allow the user to push the add button before all fields are valid.

The function containing the core part of this functionality is implemented as follows:

```javascript
    var mapToInputIcon = function(selector, validityChecker) {
        var value = $(selector).val();
        if(!value) {
            $(selector + "+ i").attr("class", "icon-asterisk");
            return false;
        } else if(validityChecker(value)) {
            $(selector + "+ i").attr("class", "icon-ok");
            return true;
        } else {
            $(selector + "+ i").attr("class", "icon-warning-sign");
            return false;
        }
    };
```

This function both sets the approperiate icon-class and returns the validity of the value. 
Not optimal, but lets roll with it. Next we use this function in conjuction with the form to 
visualize the validity of the form. The validation rules are as follows:

- Album: No duplicates, so no records with the entered name may exist in the collection.
- Artist: Has to have a value.
- Year: Has to be a valid year. Since there are no records released before the second half 
of the 1800s we can use four digits as a requirement for a valid year.
- Genre: Has to have a value.

This chunk of code is perhaps the biggest in this post. But as it is fairly repetative, 
I am going to let it pass.

```javascript
    var validAlbum = false,
        validArtist = false,
        validYear = false,
        validGenre = false;

    $("#album").on("keyup", function() {
        validAlbum = mapToInputIcon("#album", function(value) {
            return !_.any(records, {"album": value});
        });
    });

    $("#artist").on("keyup", function() {
        validArtist = mapToInputIcon("#artist", _.identity);
    });

    $("#year").on("keyup", function() {
        validYear = mapToInputIcon("#year", testRegex("^\\d{4}$"));
    });

    $("#genre").on("keyup", function() {
        validGenre = mapToInputIcon("#genre", _.identity);
    });

    $("#add-record input").on("keyup", function() {
        var valid = validAlbum && validArtist && validYear && validGenre;
        $("[type=submit]").attr("disabled", !valid);
    });
```
We are now using four different values to track the validity of the new record we wish to 
add to the collection, which are all changing when the user enters new values into the 
corresponding input field. Again we have the same pattern of reacting to events.

The final piece of functionality we want is sending the new record to the server for final 
verification.

```javascript
    var resetForm = function() {
        $("#add-record input").val("").trigger("keyup");
    };

    $("[type=submit]").on("click", function(event) {
        event.preventDefault();
        $(".loader-small").toggle(true);
        $("#add-record .error").toggle(false);
        $.ajax({
            url: "/records/new",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({
                "album": $("#album").val(),
                "artist": $("#artist").val(),
                "year": $("#year").val(),
                "genre": $("#genre").val(),
            })})
            .done(function(data) {
                records.push(data);
                resetForm();
                renderRecords(filterRecords($("#filter").val()));
            })
            .fail(function() {
                $("#add-record .error").toggle(true);
            })
            .always(function() {
                $(".loader-small").toggle(false);
            });
    });
```

Again we use the promises interface from jQuery's AJAX-API. As we are preparing the 
AJAX-request we collect the current values of the form. And as with the previous 
AJAX-request, we toggle the visibility of a spinner and a potential error-message based on 
the current state of the request. If the server returns the record to us, we reset the form 
and re-render the record collection. As a nice-to-have, we let the current active filter 
stay active.

You can view the source in its entirety 
[here](https://github.com/mollerse/frp-sbs/blob/master/static/reactive.js). 
Now that we have all the functionality we outlined for the application, lets reimplement it 
using functional reactive programming (FRP)!

## The Functional Reactive Programming Implementation

To implement the application using functional reactive programming we will use bacon.js. 
I recommend taking a look at the [documentation](https://github.com/baconjs/bacon.js) 
and have a quick read through of the API bacon.js offers. I will not go into detail with 
every method I use from the API, so I suggest keeping the docs at hand while reading on.

Because FRP is different from reactive programming in its approach to implementation the 
steps in this implementation will not line up with the steps in the previous implementation. 
Without further ado, let us begin.

The first step when implementing a user interface with FRP is to define the sources of 
events and data in the interface. In this application we have the following sources:

- Existing records from the server
- Input for the filter
- Four inputs in the form for adding new records
- Button for sending a new record to the server
- The added record received from the server

The first source of data is the AJAX-request we send to the server in order to fetch the 
existing record collection. Because a jQuery AJAX-request is based on promises, we use 
bacon.js' `Bacon.fromPromise` to create an `EventStream` of the respone.

```javascript
var records = Bacon.fromPromise($.ajax("/records"));
```

Next we have the filter and the inputs in the new record form. These will be represented as 
properties, which is the bacon.js way of representing continous values. In addition we will 
need a property representing a record, which is the aggregation of the individual properties 
from the form.

```javascript
    var propertyFromInput = function(field) {
        var value = function(event) {
            return event.currentTarget.value;
        };
        return Bacon.fromEventTarget(field, "keyup")
            .map(value)
            .toProperty("");
    };

    var recordFilter = propertyFromInput($("#filter"));
    
    var album = propertyFromInput($("#album"));
    var artist = propertyFromInput($("#artist"));
    var year = propertyFromInput($("#year"));
    var genre = propertyFromInput($("#genre"));

    var record = Bacon.combineTemplate({
            "album": album,
            "artist": artist,
            "year": year,
            "genre": genre,
    });
```

The button for triggering the addition of a new record is perhaps the most familiar piece of 
code, if you have read introductions to FRP or other blogposts about FRP before.

```javascript
    var add = Bacon.fromEventTarget($("[type=submit]"), "click")
            .doAction(".preventDefault");
```

The last source of data in this application is the AJAX-request which posts the added record 
to the server and receives it back. In addition we want to collect all added records in a 
list so we can combine it with the existing records we received from the server. To do so, 
we use a scanner.

```javascript
    var addedRecord = record.sampledBy(add)
        .flatMapLatest(function(record) {
           return Bacon.fromPromise($.ajax({
                "url": "/records/new",
                "type": "POST",
                "data": JSON.stringify(record)
            }));
        })
        .doAction(resetForm);

    var addedRecords = addedRecord.scan([], ".concat");
    var allRecords = records.combine(addedRecords, ".concat");
```

This is perhaps the most complicated piece of code in this implementation, so I will take a 
moment to step through it. The first thing we do is to take a snapshot of the value of the 
record-property when we get an event from the add-button. Then we take that value and 
prepare an AJAX-request with the value as the body. Since `Bacon.fromPromise` also returns a 
new event stream and we do not want to deal with nested handlers, we use `flatMapLatest` to 
get the latest event stream created, which is the response from the server. It is worth 
mentioning here that error-events will pass through normal handlers so that the form will 
not be reset if the request should fail.

The second step in implementing a user interface using FRP is to declare the relationships 
between the event and data sources and the various other elements of the user interface. 
In this application we have the following elements:

- A spinner to indicate a pending request for the exisiting record collection
- An error-message if fetching the existing record collection fails
- Icons visualizing the validity of the input fields in the new record form
- The enabeling of the add-button
- A spinner to indicate a pending request to add a new record to the collection
- An error-message if adding the new record failed
- A filtered view of the existing record collection and all the added records

First up is the spinner that indicates the pending request for the existing record 
collection. We only want to display it while a request is pending and hide it when we 
receive data, either records or an error.

```javascript
    records.map(Boolean).mapError(Boolean).not()
        .assign($("#records .loader"), "toggle");
```

Mapping both data and errors to Boolean values, any truthy value becomes true and any falsy 
value becomes false, and assigning it to the function `toggle` on the jQuery-object 
representing the spinner. Passing the values through `not()` is done because we want to hide 
the spinner if any data is returned from the server.

We want to display an error-message when we get an error from the server and keep it hidden 
when we get other data. We do this in the same way as with the spinner.

```javascript
    records.map(Boolean).not().mapError(Boolean)
        .assign($("#records .error"), "toggle");
```

For the input-field icons we need a bit more code. Similar to the reactive implementation, 
we need variables to represent the validity of the input field. However, in this 
implementation, rather than assigning the value of the validity we declare it as a 
relationship between the property representing the value and some validity criteria.

```javascript
    var validAlbum = album
        .combine(allRecords, function(album, records) {
            if(!album) return true;
            return _.any(records,{"album": album});
        })
        .not();
    var validArtist  = artist.map(Boolean);
    //The testRegex method is the same as the previous implementation
    var validYear = year.map(testRegex("^\\d{4}$"));
    var validGenre = genre.map(Boolean);
```

Next we map the value of the property to the corresponding icon-class and assign it to the 
correct element.

```javascript
    var mapToInputIcon = function(input, valid) {
        return input.combine(valid, function(input, valid) {
            if(!input) return "icon-asterisk";
            if(!valid) return "icon-warning-sign";
            return "icon-ok";
        });
    };

    mapToInputIcon(album, validAlbum)
        .assign($("#album + i"), "attr", "class");

    mapToInputIcon(artist, Bacon.constant(true))
        .assign($("#artist + i"), "attr", "class");

    mapToInputIcon(year, validYear)
        .assign($("#year + i"), "attr", "class");

    mapToInputIcon(genre, Bacon.constant(true))
        .assign($("#genre + i"), "attr", "class");
```

Because we decleared the validity separatly, we will not have to do assignment as a part of 
the mapping-function.

To enable the add-button when all the fields in the form are valid, we just declare a 
relationship between the validity of the input-fields and the `disabled` property of the 
correct element.

```javascript
    validAlbum.and(validArtist).and(validYear).and(validGenre).not()
        .assign($("[type=submit]"), "attr", "disabled");
```

Again we pass the value through `not()` because we want it not to be disabled when all the 
fields are valid.

For the AJAX-request for posting new records to the server we want to display a spinner, 
like with the other AJAX-request for fetching the existing record collection. We have a 
twist here though, which is that we only want to display it after we have pushed the 
add-button and the response is still pending.

```javascript
    addedRecord.map(Boolean).mapError(Boolean).not()
        .merge(add.map(Boolean))
        .assign($(".loader-small"), "toggle");
```

The relationship between the add record request and the error-message for the request is the 
same as with the request for existing records.

```javascript
    addedRecord.map(Boolean).not().mapError(Boolean)
        .assign($("#add-record .error"), "toggle");
```

Finally we want to display the filtered combination between the existing record collection 
and all the added records. So we declare the relationship between the existing records, the 
added records and the filter and assign it to the correct element in the interface.

```javascript
    allRecords
        .combine(recordFilter, filterRecords)
        .map(renderRecords)
        .assign($("#records ul"), "html");
```

The `filterRecords` and `renderRecords` functions are mostly the same as the reactive 
implementations, minus DOM insertion in `renderRecords` and a small change to the signature 
of `filterRecords`.

We have now implemented the same functionality using FRP. The source is available in its 
entirety [here](https://github.com/mollerse/frp-sbs/blob/master/static/functional.js).

## Comparison

The perhaps most apparent difference between the two techniques is in how the central 
building block handled. For the reactive implementation, everything is structured around 
which events a piece of the interface can trigger. Relations between the events that are 
happening and the data passed around is kept within each event handler. This forces us to 
sometimes handle state outside the handlers in order to create composite interaction. This 
is especially visible with the validity of the inputs in the form to create a new record.

In the FRP implementation our building blocks are, like the reactive implementation, the 
various sources of events, but with one crucial difference. Instead of writing handlers for 
the events in an imperative way, we can decleare relationships between the sources and 
between the sources and other elements of the interface. Where we had to wrangle state 
explicitly in the reactive implementation of the validity of the inputs, we can just declare 
how the validity functions relate to eachother and to the add-button. 

The same effect can also be seen with the relationship between the existing record 
collection, the added records and the filter. In the reactive implementation we manually 
maintain the state of the record collection and change the view whenever the filter changes. 
We actually call the render function, that also assigns the filtered record collection to 
the interface, from three different places in the code.

```javascript
    #Some implementation details omitted for clarity

    $.ajax("/records")
        .done(function(data) {
            records = data;
            renderRecords(records);
        })

    $("#filter").on("keyup", function() {
        renderRecords(filterRecords($(this).val()));
    });

    $.ajax({"/records/new"})
        .done(function(data) {
            records.push(data);
            renderRecords(filterRecords($("#filter").val()));
        });
```

In the FRP implementation we instead declare a relationship between the three sources. We 
avoid the manual handling of the state of the record collection. And we only call the render 
function from one place and we have separated the generation of html from the assignment to 
the correct interface element.

```javascript
    #Some implementation details omitted for clarity

    records.combine(addedRecords, ".concat")
        .combine(recordFilter, filterRecords)
        .map(renderRecords)
        .assign($("#records ul"), "html");
```

This one example is perhaps a bit unfair to the reactive implementation though, we did 
actually write more code in the FRP implementation. However, of one of the strengths of FRP 
lies in the ability to reuse sources once they have been declared. 

Say that we wanted to display the three newest additions to the record collection in a 
separate place in the interface. Imagine how much code we would have to write and rewrite if 
we wanted to do this in the reactive implementation. For the FRP implementation we would not 
have to do much handling. Since we already have the source it would just be a matter of 
expressing the relationship.