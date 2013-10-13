# Step by Step: Event Driven Programming and Functional Reactive Programming

The aim of this blogpost is to explore the differences between Event Driven
Programming and Functional Reactive Programming(FRP) by implementing the same
set of functionality with both techinques. These two techinques, while sharing
many things, offer quite different sets of tools to the developer.

Being able to compare the two approaches with a common point of reference is
useful to see which key points the two approaches differ at. And also to see
how the two approaches differ in terms of process and semantics, which is
often hard to get a grasp on when comparing programming techniques.

What this blogpost will not cover is introductory material to either approach.
Event Driven Programming is probably well known to anyone who has done
javascript, either in the browser or on the server. The all to familiar
`.on('event', handler)` is the basis of most asyncronous code in javascript.
FRP on the other hand might be unfamiliar. There are many great sources of
introductions to FRP and bacon.js, the liberary I will be using in this
blogpost. Below are some suggested reads, if you want to get the basics of FRP
before we get started;

- [Making a Collaborative Piano Using Functional Reactive Programming](open.bekk.no/making-a-collaborative-piano-using-functional-reactive-programming-frp)
- [Functional Reactive Programming in JavaScript](http://flippinawesome.org/2013/09/30/functional-reactive-programming-in-javascript/)
- [Bacon.js Tutorial Part I : Hacking With jQuery](http://nullzzz.blogspot.fi/2012/11/baconjs-tutorial-part-i-hacking-with.html) (and its followups)
- [Bacon.js Makes Functional Reactive Programming Sizzle](http://blog.flowdock.com/2013/01/22/functional-reactive-programming-with-bacon-js/)
- [Bacon.js API docs](https://github.com/baconjs/bacon.js)
- [061 JSJ Functional Reactive Programming with Juha Paananen and Joe Fiorini](http://javascriptjabber.com/061-jsj-functional-reactive-programming-with-juha-paananen-and-joe-fiorini/)

I will walk through the two implementations step by step explaining the
process as I go along. A demo of the application will be available [here](http
://frp-sbs.herokuapp.com) and I suggest taking it for a spin now to get a feel
for the functionality it offers. It might be handy to keep it around for
reference as you read along.

## The Application Before we get down to the business of code, we will need to
define our application. The application used for the comparison will be a
simple record (the vinyl kind, not the data kind) collection It will list out
records in the collection and allow the user to add new records. To ensure
consistency in the collection, the application will only allow unique records
and valid data.

To achieve this functionality, there are a few things we need to implement:

- Fetching records from a server
- Listing records in the collection
- A way to filter the viewed records
- Adding a new record to the collection
- Informing the user wether the data entered is valid
- Sending the new record to the server for verification
- Receiving the new record or an error from the server
- Adding the new record to the viewed collection

This looks like a fairly simple task. First, let us implement it with event
driven programming, using the familiar jQuery liberary. Let us also throw in
some LoDash to get some nice functional handling of collections.

## The Event Driven Implementation

First thing we need is to fetch the record collection from the server when we
load the page. We can do this using the excellent promise-based AJAX API in
jQuery:

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

This is familiar stuff to anyone that has done AJAX-requests in the browser
and the promises interface makes it very clean. If the request succeeds, we
set the data received to be the current record collection and render it. If
the request fails to get the record collection from the server, we show an
error-message. Regardless of wether the request succeed or fail, we hide the
spinner that indicates a pending request.

To render the record collection we reduce the records to a string of markup
and insert it into the DOM:

```javascript
    var renderRecords = function(records) {
        var items = _.reduce(records, function(acc, record) {
            return acc + 
                "<li>" +
                    "<h3>" + record.album + "</h3>" +
                    "<p>Artist: " + record.artist + "</p>" +
                    "<p>Year: " + record.year + "</p>" +
                    "<p>Genre: " + record.genre + "</p>" +
                "</li>";
        }, "");
        $("#records ul").html(items);
    };
```

We can already see a trend in the way values are assigned to elements in the
application, always as a reaction to an event occuring. We set the visibility
of the error-message and spinner and the value of the record collection based
on what we receive back when the AJAX-request returns. This is event driven
programming. Things happening as a response to an event.

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

With two helper functions, to filter out which records match the query, and an
event-listener to collect the value to filter for, we get a nice little search
functionality for our record collection. If the `filterRecords` function look
a bit unfamiliar to you I suggest checking out the [LoDash
documentation](http://lodash.com/docs). Again we see the same pattern, the
contents of the list displaying the records change as a reaction to the events
triggered. Also note that we have now called the `renderRecords` function
twice from two different places.

We now have the ability to view and filter the records in the collection
received from the server. But we also want to be able to add new records into
the collection. To make the example a little bit more interesting, and maybe
more user-friendly, we will use icons to indicate the validity of the values
entered into the form. Each value required will have three states; missing,
invalid and valid. And to add a bit of enforcement to the validitiy, the
application will not allow the user to push the add button before all fields
are valid.

The function containing the core part of this functionality is implemented as
follows:

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

This function both sets the approperiate icon-class and returns the validity
of the value. Not optimal, but lets roll with it. Next we use this function in
conjuction with the form to visualize the validity of the form. The validation
rules are as follows:

- Album: No duplicates, so no records with the entered name may exist in the collection.
- Artist: Has to have a value.
- Year: Has to be a valid year. Since there are no records released before the second half 
of the 1800s we can use four digits as a requirement for a valid year.
- Genre: Has to have a value.

This chunk of code is perhaps the biggest in this post. But as it is fairly
repetative, I am going to let it pass.

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

We are now using four different variables to track the validity of the new
record we wish to add to the collection, which are all changing when the user
enters new values into the corresponding input field. Again we have the same
pattern of reacting to events. We also find ourselves in the situation where
we have to keep track of a relatively complex state; the combined validtity of
four fields making up the validity of a single record.

The final piece of functionality we want is sending the new record to the
server for final verification.

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

Again we use the promises interface from jQuery's AJAX-API. As we are
preparing the AJAX-request we collect the current values of the form. And as
with the previous AJAX-request, we toggle the visibility of a spinner and a
potential error-message based on the current state of the request. If the
server returns the record to us, we reset the form and re-render the record
collection. As a nice-to-have, we let the current active filter stay active.
This also marks the third time we call the `renderRecords` function.

You can view the source in its entirety [here](https://github.com/mollerse
/frp-sbs/blob/master/static/reactive.js). Now that we have all the
functionality we outlined for the application, lets reimplement it using
functional reactive programming (FRP)!

## The Functional Reactive Programming Implementation

To implement the application using functional reactive programming we will use
bacon.js. If you did not checkout the links I presented at the beginning of
this post, and especially the [bacon.js API
docs](https://github.com/baconjs/bacon.js), I will make that suggestion again.
I will not go into detail with every method I use from the API, so I suggest
keeping the docs at hand while reading on.

Because FRP is different from event driven programming in its approach to
implementation the steps in this implementation will not line up with the
steps in the previous implementation. Without further ado, let us begin.

The first step when implementing a user interface with FRP is to define the
sources of events and data in the interface. In this application we have the
following sources:

- Existing records from the server
- Input for the filter
- Four inputs in the form for adding new records
- Button for sending a new record to the server
- The added record received from the server

The first source of data is the AJAX-request we send to the server in order to
fetch the existing record collection. Because a jQuery AJAX-request is based
on promises, we use bacon.js' `Bacon.fromPromise` to create an `EventStream`
of the respone.

```javascript
var records = Bacon.fromPromise($.ajax("/records"));
```

Next we have the filter and the inputs in the new record form. These will be
represented as properties, which is the bacon.js way of representing continous
values. In addition we will need a property representing a record, which is
the aggregation of the individual properties from the form.

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

The button for triggering the addition of a new record is perhaps the most
familiar piece of code, if you have read introductions to FRP or other
blogposts about FRP before.

```javascript
    var add = Bacon.fromEventTarget($("[type=submit]"), "click")
            .doAction(".preventDefault");
```

The last source of data in this application is the AJAX-request which posts
the added record to the server and receives it back. In addition we want to
collect all added records in a list so we can combine it with the existing
records we received from the server. To do so, we use a scanner to create a
composite property from all the events in the stream. We also want a property
that represents the combination of all the records in the application.

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

This is perhaps the most complicated piece of code in this implementation, so
I will take a moment to step through it. The first thing we do is to take a
snapshot of the value of the record-property when we get an event from the
add-button. Then we take that value and prepare an AJAX-request with the value
as the body. Since `Bacon.fromPromise` also returns a new event stream and we
do not want to deal with nested handlers, we use `flatMapLatest` to get the
latest event stream created, which is the response from the server. It is
worth mentioning here that error-events will pass through normal handlers so
that the form will not be reset if the request should fail.

The second step in implementing a user interface using FRP is to declare the
relationships between the event and data sources and the various other
elements of the user interface. In this application we have the following
elements:

- A spinner to indicate a pending request for the exisiting record collection
- An error-message if fetching the existing record collection fails
- Icons visualizing the validity of the input fields in the new record form
- The enabeling of the add-button
- A spinner to indicate a pending request to add a new record to the collection
- An error-message if adding the new record failed
- A filtered view of the existing record collection and all the added records

First up is the spinner that indicates the pending request for the existing
record collection. We only want to display it while a request is pending and
hide it when we receive data, either records or an error.

```javascript
    records.map(Boolean).mapError(Boolean).not()
        .assign($("#records .loader"), "toggle");
```

Mapping both data and errors to Boolean values, any truthy value becomes
`true` and any falsy value becomes `false`, and assigning it to the function
`toggle` on the jQuery-object representing the spinner. Passing the values
through `not()` is done because we want to hide the spinner if any data is
returned from the server.

We want to display an error-message when we get an error from the server and
keep it hidden when we get other data. We do this in the same way as with the
spinner. We pass records through `not()` before we map the errors because we
want any data to keep the error-message hidden.

```javascript
    records.map(Boolean).not().mapError(Boolean)
        .assign($("#records .error"), "toggle");
```

For the input-field icons we need a bit more code. Similar to the event driven
implementation, we need variables to represent the validity of the input
field. However, in this implementation, rather than assigning the value of the
validity we declare it as a relationship between the property representing the
value and some validity criteria.

```javascript
    var validAlbum = album
        .combine(allRecords, function(album, records) {
            if(!album) return false;
            return !_.any(records,{"album": album});
        });
    var validArtist  = artist.map(Boolean);
    //The testRegex method is the same as in the event driven implementation
    var validYear = year.map(testRegex("^\\d{4}$"));
    var validGenre = genre.map(Boolean);
```

Next we map the value of the property to the corresponding icon-class and
assign it to the correct element.

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

Because we decleared the validity separatly, we will not have to do assignment
as a part of the mapping-function.

To enable the add-button when all the fields in the form are valid, we just
declare a relationship between the validity of the input-fields and the
`disabled` property of the correct element.

```javascript
    validAlbum.and(validArtist).and(validYear).and(validGenre).not()
        .assign($("[type=submit]"), "attr", "disabled");
```

Again we pass the value through `not()` because we want it not to be disabled
when all the fields are valid.

For the AJAX-request for posting new records to the server we want to display
a spinner, like with the other AJAX-request for fetching the existing record
collection. We have a twist here though, which is that we only want to display
it after we have pushed the add-button and the response is still pending.

```javascript
    addedRecord.map(Boolean).mapError(Boolean).not()
        .merge(add.map(Boolean))
        .assign($(".loader-small"), "toggle");
```

The relationship between the add record request and the error-message for the
request is the same as with the request for existing records.

```javascript
    addedRecord.map(Boolean).not().mapError(Boolean)
        .assign($("#add-record .error"), "toggle");
```

Finally we want to display the filtered combination between the existing
record collection and all the added records. So we declare the relationship
between the existing records, the added records and the filter and assign it
to the correct element in the interface.

```javascript
    allRecords
        .combine(recordFilter, filterRecords)
        .map(renderRecords)
        .assign($("#records ul"), "html");
```

The `filterRecords` and `renderRecords` functions are mostly the same as the
reactive implementations, minus DOM insertion in `renderRecords` and a small
change to the signature of `filterRecords`.

We have now implemented the same functionality using FRP. The source is
available in its entirety [here](https://github.com/mollerse/frp-
sbs/blob/master/static/functional.js).

## Comparison

I want to discuss two key differences between the two approaches; How to
handle composite behavior and how to assign new values to interface
components.

In the event driven implementation, we had to add some state to the code in
order to get behavior that depended on more than one source of data. The two
examples in this application are the record collection, which is manipulated
by the two AJAX-requests, and the validity checks of the input fields, which
controls the enabeling of the add-button. These pieces of state are mutated
from within event handlers and read from within event handlers.

The same two examples in the functional reactive implementation also have the
same functionality, but it does not rely on explicit shared state to achieve
it. Where we had to manually wrangle state in the event driven implementation,
we have the power of declarative relationships in FRP. Rather than assigning
value to a variable and manually updating it whenever something would cause it
to change, we can declare how a value change when other values change and let
the underlying mechanics handle the actual updating of the value.

The other key difference is how values are assigned to the different interface
components. Again we have two good examples. The first is how the value of the
list that displays records change and the second is how the icons that signal
the state of the input fields in the form for adding new records. In the event
driven implementation we manually call the function to render the record
collection list three times in three different places.

```javascript
    #Some implementation details omitted for clarity

    $.ajax("/records") //GET
        .done(function(data) {
            records = data;
            renderRecords(records);
        })

    $("#filter").on("keyup", function() {
        renderRecords(filterRecords($(this).val()));
    });

    $.ajax("/records/new") //POST
        .done(function(data) {
            records.push(data);
            renderRecords(filterRecords($("#filter").val()));
        });
```

This means that the list of records now has three different reasons to change,
so a bug with the displaying of records could come from one of three different
places. And this application is not even that complex. This is one of the
reasons behind the rise of MVC-like abstractions for handling complex
interfaces in frontend web development.

The same functionality is achieved in the FRP implementation like so:

```javascript
    #Some implementation details omitted for clarity

    records.combine(addedRecords, ".concat")
        .combine(recordFilter, filterRecords)
        .map(renderRecords)
        .assign($("#records ul"), "html");
```

This reduces the number of times the value of the list displaying the records
changes to one. This is very similar to the same benefits you get from using a
model-view-abstraction and tracking change events.

We observe the same change in behavior with the icons visualizing the validity
of the input fields, but the change is not as drastic as it was with the
displaying of the record collection.

There is also the benefit of a higher level of abstraction and an approach
that lies closer to how we reason about interface components. The declarative
nature of FRP enables us to think in terms of what we want to achieve with our
interface instead of focusing on the explicit how.

In addition we get the benefits of functional programming with FRP, but
covering those would be a whole blogpost in its own right. Besides, there are
plenty of excellent sources on that around.

## Closing Remarks

I have only pointed to two differences in this blogpost, but there are many
subtle differences that could be major for various usecases. So my suggestion
to anyone wishing to spend some time studying FRP is to repeat the exercise of
implementing the same application in both your preferred techinique and FRP.
This blogpost has hopefully convinced you that it would be a worthwile effort.