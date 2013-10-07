# Step by Step: From Reactive Programming to Functional Reactive Programming

This blogpost will be a side by side comparison of the same application implemented 
in both traditional reactive programming and functional reactive programming (FRP). 
If you are not familiar with functional reactive programming, I suggest you go read 
[Making a Collaborative Piano Using Functional Reactive Programming](open.bekk.no/making-a-collaborative-piano-using-functional-reactive-programming-frp) for an introduction to the 
concept of FRP.

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

A demo of the application is available [here](http://frp-sbs.herokuapp.com). I suggest 
taking it for a spin now and keep it around for reference as we go through the 
implementation details.

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

This is familiar stuff to anyone that has done any AJAX in the browser, and the promises 
interface makes it very clean. If the AJAX-request succeeds, we set the data received to be 
the current record collection and render it. If the AJAX-request fails to get the record 
collection from the server, we show an error-message. Regardless of wether the request succeed or fail, we hide the spinner that indicates a pending request.

To render the record collection we reduce the records to a string of markup and insert it 
into the DOM:

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
add to the collection, which are all changing when the user enters new values into the corresponding input field. Again we have the same pattern of reacting to events.

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
AJAX-request we collect the current values of the form. And as with the previous AJAX-request, we toggle the visibility of a spinner and a potential error-message based on the current state of the request. If the server returns the record to us, we reset the form and re-render the record collection. As a nice-to-have, we let the current active filter stay active.

You can view the source in its entirety 
[here](https://github.com/mollerse/frp-sbs/blob/master/static/reactive.js). 
Now that we have all the functionality we outlined for the application, lets reimplement it 
using functional reactive programming (FRP)!

## The Functional Reactive Programming Implementation

