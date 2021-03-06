$(function() {
    var renderRecords = function(records) {
        return _.reduce(records, function(acc, record) {
            return acc + "<li>" +
                "<h3>" + record.album + "</h3>" +
                "<p> Artist: " + record.artist + "</p>" +
                "<p>Year: " + record.year + "</p>" +
                "<p>Genre: " + record.genre + "</p>" +
                "</li>";
        }, "");
    };

    var testRegex = function(pattern) {
        return function(value) {
            if(!value) return false;
            return new RegExp(pattern, "i").test(value);
        };
    };

    var filterRecords = function(records, recordFilter) {
        return _.filter(records, function(record) {
            return _(record).values().any(testRegex(recordFilter));
        });
    };

    var mapToInputIcon = function(input, valid) {
        return input.combine(valid, function(input, valid) {
            if(!input) return "icon-asterisk";
            if(!valid) return "icon-warning-sign";
            return "icon-ok";
        });
    };
    
    var resetForm = function() {
        $("#add-record input").val("").trigger("keyup");
    };

    var propertyFromInput = function(field) {
        var value = function(event) {
            return event.currentTarget.value;
        };
        return Bacon.fromEventTarget(field, "keyup")
            .map(value)
            .toProperty("");
    };

    var records = Bacon.fromPromise($.ajax("/records"));

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

    var add = Bacon.fromEventTarget($("[type=submit]"), "click")
            .doAction(".preventDefault");

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

    var validAlbum = album
        .combine(allRecords, function(album, records) {
            if(!album) return false;
            return !_.any(records,{"album": album});
        });
    var validArtist  = artist.map(Boolean);
    var validYear = year.map(testRegex("^\\d{4}$"));
    var validGenre = genre.map(Boolean);

    records.map(Boolean).mapError(Boolean).not()
        .assign($("#records .loader"), "toggle");

    records.map(Boolean).not().mapError(Boolean)
        .assign($("#records .error"), "toggle");

    mapToInputIcon(album, validAlbum)
        .assign($("#album + i"), "attr", "class");

    mapToInputIcon(artist, Bacon.constant(true))
        .assign($("#artist + i"), "attr", "class");

    mapToInputIcon(year, validYear)
        .assign($("#year + i"), "attr", "class");

    mapToInputIcon(genre, Bacon.constant(true))
        .assign($("#genre + i"), "attr", "class");

    validAlbum.and(validArtist).and(validYear).and(validGenre).not()
        .assign($("[type=submit]"), "attr", "disabled");

    addedRecord.map(Boolean).mapError(Boolean).not()
        .merge(add.map(Boolean))
        .assign($(".loader-small"), "toggle");

    addedRecord.map(Boolean).not().mapError(Boolean)
        .assign($("#add-record .error"), "toggle");

    allRecords
        .combine(recordFilter, filterRecords)
        .map(renderRecords)
        .assign($("#records ul"), "html");
});