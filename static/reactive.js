$(function() {
    var records = [],
        validAlbum = false,
        validArtist = false,
        validYear = false,
        validGenre = false;

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

    var resetForm = function() {
        $("#add-record input").val("").trigger("keyup");
    };

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


    $("#filter").on("keyup", function() {
        var filter = $(this).val();
        renderRecords(filterRecords(filter));
    });

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
});