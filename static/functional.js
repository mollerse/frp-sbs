$(function() {
    var renderRecords = function(records) {
        var items = _.reduce(records, function(acc, record) {
            return acc + "<li>" +
                "<h3>" + record.album + "</h3>" +
                "<p> Artist: " + record.artist + "</p>" +
                "<p>Year: " + record.year + "</p>" +
                "<p>Genre: " + record.genre + "</p>" +
                "</li>";
        }, "");
        $("#records ul").html(items);
    };

    var filterRecords = function(records, recordFilter) {
        return _.filter(records, function(record) {
            return _(record).values().any(testRegex(recordFilter));
        });
    };

    var testRegex = function(pattern) {
        return function(value) {
            if(!value) return false;
            return new RegExp(pattern, "i").test(value);
        };
    };

    var propertyFromInput = function(field) {
        var value = function(event) {
            return event.currentTarget.value;
        };
        return Bacon.fromEventTarget(field, "keyup")
            .map(value)
            .toProperty("");
    };

    var resetForm = function() {
        $("#add-record input").val("").trigger("keyup");
    };

    var mapToInputIcon = function(input, valid) {
        return input.combine(valid, function(input, valid) {
            if(!input) return "icon-asterisk";
            if(!valid) return "icon-warning-sign";
            return "icon-ok";
        });
    };

    var records = Bacon.fromPromise($.ajax("/records"));

    var add = Bacon.fromEventTarget($("[type=submit]"), "click")
            .doAction(".preventDefault");

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

    var addedRecord = record.sampledBy(add)
        .flatMapLatest(function(record) {
           return Bacon.fromPromise($.ajax({
                "url": "/records/new",
                "type": "POST",
                "data": JSON.stringify(record)
            }));
        })
        .doAction(resetForm);

    var validAlbum = album
        .combine(records, function(album, records) {
            if(!album) return true;
            return _.any(records,{"album": album});
        })
        .not();
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

    //TODO: Nye records overskriver gamle

    var allRecords = addedRecord.flatMapLatest(function(val) {
        return Bacon.constant(val);
    });

    // records.combine(constantRecord, ".concat").log()

    records.combine(recordFilter, filterRecords)
        .onValue(renderRecords);
});