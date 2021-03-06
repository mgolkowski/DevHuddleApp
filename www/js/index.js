var db;

// location of XML files
var baseURL = 'https://raw.githubusercontent.com/mgolkowski/DevHuddleApp/master/www/';
var lastUpdateURL = 'LastTOCUpdate.xml';
var TOC_URL = 'TOC.xml';
var ARTICLE_URL = "ArticleARTICLEID.xml";

var app = {

    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },

    showMessage: function (msg) {
        $('.listening').text(msg);
    },

    bindEvents: function () {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },

    onDeviceReady: function () {
       
        app.receivedEvent('deviceready');
        db = window.sqlitePlugin.openDatabase({ name: "my.db" });
        
        // TEST ONLY - don't wipe it on load once it's working

        // start initialization
        //app.wipeAllData(); // <= FOR TESTING ONLY
        app.createDatabases();

    },

    // set TOC.isDownloaded = true for all articles in Article table
    populateTOCisDownloaded: function (doLoadTOC) {

        db.transaction(function (tx) {
            tx.executeSql("UPDATE TOC SET isDownloaded = 0", [], function (tx, res) {

                tx.executeSql("SELECT * FROM Article;", [], function (tx, res) {

                    var updatesToGo = res.rows.length;

                    if (updatesToGo == 0 && doLoadTOC) {
                        app.loadTOC();
                        return;
                    }

                    for (var i = 0; i < res.rows.length; i++) {
                        tx.executeSql("UPDATE TOC SET isDownloaded = 1 WHERE id = ?", [res.rows.item(i).id], function (tx, res) {
                            updatesToGo--;
                            if (updatesToGo == 0 && doLoadTOC) {
                                app.loadTOC();
                            }
                        });
                    }
                });               
            });
        });        
    },

    wipeAllData: function () {

        app.showMessage('Wiping Data');

        db.transaction(function (tx) {
            tx.executeSql('DROP TABLE IF EXISTS LastTOCUpdate;');
            db.transaction(function (tx) {
                tx.executeSql('DROP TABLE IF EXISTS TOC;');
                db.transaction(function (tx) {
                    tx.executeSql('DROP TABLE IF EXISTS Article;');
                    db.transaction(function (tx) {

                        app.createDatabases();

                    })
                })
            });
        });        
    },

    // Create databases (if required), then call checkTOCTimestamp when done to continue initialization
    createDatabases: function () {

        app.showMessage('Creating databases');

        db.transaction(function (tx) {
            tx.executeSql('CREATE TABLE IF NOT EXISTS LastTOCUpdate (lastUpdate text)');
            db.transaction(function (tx) {
                tx.executeSql('CREATE TABLE IF NOT EXISTS TOC (id integer, title text, dscr text, isDownloaded integer)');
                db.transaction(function (tx) {
                    tx.executeSql('CREATE TABLE IF NOT EXISTS Article (id integer, html text)');
                    db.transaction(function (tx) {

                        app.checkTOCTimestamp(tx);  // all done, continue initialization by updating table of contents

                    })
                })
            });
        });
    },

    // Compare TOC timestamp on server with last TOC update in app
    // Refresh TOC in app if needed, then continue initialization
    checkTOCTimestamp: function (tx) {

        app.showMessage('Processing updates');

        // Check if LastTOCUpdate table has a row in it (to store last update timestamp)
        tx.executeSql("SELECT COUNT(*) AS cnt from LastTOCUpdate;", [], function (tx, res) {

            var numRows = res.rows.item(0).cnt; // number of rows in LastTOCUpdate
           
            // no row = first time - set last update to 1900 to force initial refresh, then continue
            if (numRows == 0) { 

                
                tx.executeSql("INSERT INTO LastTOCUpdate (lastUpdate) VALUES (?)", ["1900-01-01"], function (tx, res) {                           

                    app.doServerTOCUpdate("1900-01-01");

                }, function (e) {
                    app.showMessage("ERROR (checkTOCTimestamp): " + e.message);
                });

            } else { // already has a row - read last TOC update

                db.transaction(function (tx) {
                    tx.executeSql("SELECT lastUpdate from LastTOCUpdate;", [], function (tx, res) {

                        var retval = res.rows.item(0).lastUpdate;

                        app.doServerTOCUpdate(retval);

                    }, function (e) {
                        app.showMessage("ERROR (checkTOCTimestamp): " + e.message);
                    });
                });
            }
        });
    },
    
    // Checks TOC timestamp on server.  If server timestamp > lastTimestamp then refresh TOC
    doServerTOCUpdate: function (lastTimestamp) {

        var myRand = Math.floor((Math.random() * 1000) + 1);

        
        $.ajax({
            cache: false,
            headers: { "cache-control": "no-cache" },
            url: baseURL + lastUpdateURL, para: myRand,
            type: 'GET',
            success: function (data) {

                var xmlDoc = $.parseXML(data),
                $xml = $(xmlDoc),
                $lastUpdate = $xml.find("lastUpdate");

                var dLastUpdateServer = new Date($lastUpdate.text());
                var dLastTimestamp = new Date(lastTimestamp);

                if (dLastUpdateServer > dLastTimestamp) {   // TOC needs updating - grab new TOC from server

                    app.refreshTOC($lastUpdate.text());

                } else { // TOC is up to date - just display it
                    
                    app.loadTOC();

                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                app.loadTOC(); // can't connect online - try to load it anyways
            }
        });        
    },

    // reload the table of contents from the server then display
    refreshTOC: function (newTimestamp) {
        var myRand = Math.floor((Math.random() * 1000) + 1);
        app.showMessage('Retrieving new TOC from server');

        $.ajax({
            cache: false,
            headers: { "cache-control": "no-cache" },
            url: baseURL + TOC_URL, para: myRand,
            type: 'GET',
            success: function (data) {

                var xmlDoc = $.parseXML(data);
                $xml = $(xmlDoc);

                db.transaction(function (tx) {
                    tx.executeSql("UPDATE LastTOCUpdate SET lastUpdate = ?", [newTimestamp], function (tx, res) {
                        app.refreshTOCDB($xml);
                    });
                });              
                
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                app.loadTOC(); // can't connect to internet, try loading it from database anyways                
            }
        });
    },

    refreshTOCDB: function (data) {

        app.showMessage('Refreshing TOC in database');

        db.transaction(function (tx) {

            // 1) delete all TOC in database
            tx.executeSql("DELETE FROM TOC", [], function (tx, res) {

                // 2) loop through all TOC items and put into databse
                var rowCnt = $(data).find('dataItem').length;

                $(data).find('dataItem').each(function () {

                    var id = $(this).find('id').text();
                    var title = $(this).find('title').text();
                    var dscr = $(this).find('dscr').text();

                    tx.executeSql("INSERT INTO TOC (id, title, dscr, isDownloaded) VALUES (?,?,?,?)", [id, title, dscr, 0], function (tx, res) {

                        rowCnt -= 1;
                        if (rowCnt == 0) {
                            app.populateTOCisDownloaded(true);                            
                        }
                    }, function (e) {
                        rowCnt -= 1;
                        alert("ERROR2: " + e.message);
                    });
                });

                // 3) update timestamp

            }, function (e) {
                alert("ERROR3: " + e.message);
            });
        });
    },

    loadArticle: function (id,isDownloaded) {

        if (isDownloaded) { // article is cached, display cached article

            db.transaction(function (tx) {
                tx.executeSql("SELECT * FROM Article WHERE id = ?;", [parseInt(id)], function (tx, res) {
                    if (res.rows.length > 0) {

                        var articleHTML = res.rows.item(0).html;
                        var theHTML = '<img src="img/logo.png" style="max-width: 100%" /><div style="margin-bottom: 20px"><a href="#" onclick="app.goToTOC(); return false">back to table of contents</a></div>';
                        theHTML += '<div style="margin-right: 20px">' + articleHTML + '</div>';
                        theHTML += '<div style="margin: 20px 0 20px 0"><a href="#" onclick="app.goToTOC(); return false">back to table of contents</a></div>'

                        $('#divTOC').hide();
                        $('#divLoading').hide();
                        $('#divArticle').html(theHTML).show();

                    }
                });
            });

        } else { // article not yet cached - grab it from server

            $('#divArticle').hide();
            $('#divTOC').hide();
            $('#divLoading').show();

            app.showMessage('Loading article from server');

            var myRand = Math.floor((Math.random() * 1000) + 1);
            $.ajax({
                cache: false,
                headers: { "cache-control": "no-cache" },
                url: baseURL + ARTICLE_URL.replace("ARTICLEID", id), para: myRand,
                type: 'GET',
                success: function (data) {

                    var xmlDoc = $.parseXML(data);
                    $xml = $(xmlDoc);

                    var theXML = $xml.find('html').text();

                    var theHTML = '<img src="img/logo.png" style="max-width: 100%" /><div style="margin-bottom: 20px"><a href="#" onclick="app.goToTOC(); return false">back to table of contents</a></div>';
                    theHTML += '<div style="margin-right: 20px">' + theXML + '</div>';
                    theHTML += '<div style="margin: 20px 0 20px 0"><a href="#" onclick="app.goToTOC(); return false">back to table of contents</a></div>'

                    $('#divTOC').hide();
                    $('#divLoading').hide();
                    $('#divArticle').html(theHTML).show();

                    // save article in database and update TOC
                    app.saveArticle(parseInt(id), theXML);
                },
                error: function (XMLHttpRequest, textStatus, errorThrown) {

                    alert('Unable to download article - please make sure you are connected to the internet and try again');
                    $('#divLoading').hide();
                    $('#divArticle').hide();
                    $('#divTOC').show();
                }
            });
        }
    },

    saveArticle: function(id, theXML) {
        
        db.transaction(function (tx) {
            tx.executeSql("INSERT INTO Article (id, html) VALUES (?, ?)", [id, theXML], function (tx, res) {

                app.populateTOCisDownloaded(false);

            }, function (e) {

                alert('error4 here');
                app.showMessage("ERROR (checkTOCTimestamp): " + e.message);
            });
        });
    },
    goToTOC: function () {
        $('#divArticle').hide();
        $('#divLoading').show();
        app.loadTOC();
    },
    // load TOC from database and display it on screen
    loadTOC: function () {

        app.showMessage('Loading TOC for display');
        
        db.transaction(function (tx) {
            tx.executeSql("SELECT * FROM TOC ORDER BY id DESC;", [], function (tx, res) {

                var numRows = res.rows.length;
                var html = '<img src="img/logo.png" style="max-width: 100%" /><a href="#" onclick="app.exitFromApp(); return false">close app</a>';
                html += '<div style="margin-right: 20px"><h1 style="margin-top: 20px">Table of Contents</h1><hr/>';
                for (var i = 0; i < numRows; i++) {
                    html += '<div class="clsDivTOC';
                    if (res.rows.item(i).isDownloaded == 1) {
                        html += ' clsOffline';
                    }
                    html +='"><a class="aTOC" href="#" onclick="app.loadArticle(' + res.rows.item(i).id + ',' + res.rows.item(i).isDownloaded + ')">' + res.rows.item(i).title + '</a><p class="pTOC">' + res.rows.item(i).dscr + '</p></div>';
                }
                html += '</div>';
                $('#divTOC').html(html).show();
                $('#divLoading').hide();
            });
        });
    },

    // Update DOM on a Received Event
    receivedEvent: function(id) {
        $('#divLoading').hide();
    },

    exitFromApp: function() {
        navigator.app.exitApp();
    }
};
