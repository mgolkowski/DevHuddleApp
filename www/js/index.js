 /*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var db;
var baseURL = 'https://raw.githubusercontent.com/mgolkowski/DevHuddleApp/master/www/';
var lastUpdateXML = 'LastTOCUpdate.xml';
var tocXML = 'TOC.xml';

var app = {

    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'

    onDeviceReady: function () {
       
        app.receivedEvent('deviceready');
        db = window.sqlitePlugin.openDatabase({ name: "my.db" });

        app.updateTOC();
    },

    // Reads the last update timestamp of the table of contents from the database
    // If never updated (first time) then set it to 1900-01-01 to force initial refresh
    // Then, compare this timestamp against server, if if server is newer then refresh TOC 
    updateTOC: function () {

        db.transaction(function (tx) {

            // Create DB table (if not already created) to store last TOC update
            tx.executeSql('CREATE TABLE IF NOT EXISTS LastTOCUpdate (lastUpdate text)');
            db.transaction(function (tx) {

                // DB exists or has been created.  Check for a row to hold data
                tx.executeSql("SELECT COUNT(*) AS cnt from LastTOCUpdate;", [], function (tx, res) {
                    var numRows = res.rows.item(0).cnt;

                    if (numRows == 0) { // no row =first time - set last update to 1900 to force initial refresh

                        tx.executeSql("INSERT INTO LastTOCUpdate (lastUpdate) VALUES (?)", ["1900-01-01"], function (tx, res) {
                            

                            app.getServerTOCUpdate("1900-01-01");

                        }, function (e) {
                            alert("ERROR in Insert: " + e.message);
                        });

                    } else { // already has a row - read it

                        db.transaction(function (tx) {
                            tx.executeSql("SELECT lastUpdate from LastTOCUpdate;", [], function (tx, res) {

                                var retval = res.rows.item(0).lastUpdate;
                                app.doServerTOCUpdate(retval);

                            }, function (e) {
                                alert("ERROR in Select: " + e.message);
                            });
                        });
                    }
                });
            });
        });
    },

    // checks TOC timestamp on server, and if > lastTimestamp then refresh TOC in database
    // then renders splash screen

    doServerTOCUpdate: function (lastTimestamp) {

        $.ajax({
            url: baseURL + lastUpdateXML,
            type: 'GET',
            success: function (data) {

                var xmlDoc = $.parseXML(data),
                $xml = $(xmlDoc),
                $lastUpdate = $xml.find("lastUpdate");

                var dLastUpdateServer = new Date($lastUpdate.text());
                var dLastTimestamp = new Date(lastTimestamp);

                if (dLastUpdateServer > dLastTimestamp) {   // server is newer - refresh
                    app.refreshTOC($lastUpdate.text());

                } else {
                    // UP TO DATE - just display TOC
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                alert("Error status :" + textStatus);
                alert("Error type :" + errorThrown);
                alert("Error message :" + XMLHttpRequest.responseXML);
            }
        });        
    },

    // reload the table of contents from the server then display
    refreshTOC: function (newTimestamp) {

        $.ajax({
            url: baseURL + tocXML,
            type: 'GET',
            success: function (data) {

                var xmlDoc = $.parseXML(data);
                $xml = $(xmlDoc);

                app.refreshTOCDB($xml);
                
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                alert("Error status :" + textStatus);
                alert("Error type :" + errorThrown);
                alert("Error message :" + XMLHttpRequest.responseXML);
            }
        });
    },

    refreshTOCDB: function (data) {

        db.transaction(function (tx) {

            // Create DB table (if not already created) to store last TOC update
            tx.executeSql('CREATE TABLE IF NOT EXISTS TOC (id integer, title text, dscr text, lastUpdate text)');
            db.transaction(function (tx) {

                // 1) delete all TOC in database
                tx.executeSql("DELETE FROM TOC", [], function (tx, res) {

                    // 2) loop through all TOC items and put into databse
                    var rowCnt = $(data).find('dataItem').length;

                    $(data).find('dataItem').each(function () {

                        var id = $(this).find('id').text();
                        var title = $(this).find('title').text();
                        var dscr = $(this).find('dscr').text();
                        var lastUpdate = $(this).find('lastUpdate').text();

                        tx.executeSql("INSERT INTO TOC (id, title, dscr, lastUpdate) VALUES (?,?,?,?)", [id, title, dscr, lastUpdate], function (tx, res) {
                            alert('row inserted');
                            rowCnt -= 1;
                            if (rowCnt == 0) {
                                alert("ALL DONE!!!");
                                app.loadTOC();
                            }
                        }, function (e) {
                            rowCnt -= 1;
                            alert("ERROR in refreshTOCDB 1: " + e.message);
                        });
                        
                    });

                    // 3) update timestamp

                }, function (e) {
                    alert("ERROR in refreshTOCDB 2: " + e.message);
                });

            });
        });
    },

    // displays an article
    // first, checks update timestamp of article - if >= server then display from DB
    // otherwise, load from server, update DB, and display
    loadArticle: function (id) {

        alert('in loadArticle: ' + id);

        // first, try to load article from database (and create table if necessary)
        db.transaction(function (tx) {

            // Create DB table (if not already created)
            tx.executeSql('CREATE TABLE IF NOT EXISTS Article (id integer, html text, lastUpdate text)');
            db.transaction(function (tx) {

                // Try to retrieve article from DB
                tx.executeSql("SELECT * from Article WHERE id = ?;", [id], function (tx, res) {

                    alert('reading article.');
                    alert('rows: ' + res.rows.item.length);

                    if (res.rows.item.length == 0) { // article not loaded in db yet - load and display

                    } else { // article exists - compare last update timestamp with TOC 

                    }

                }, function (e) {
                    alert("ERROR in loadArticle: " + e.message);
                });

            });
        });

       

        // check if article is loaded into db


        $('#divTOC').hide();
        $('#divArticle').show().html('<h1>todo</h1>');
        
    },

    // load TOC from database and display it on screen
    loadTOC: function () {

        
        db.transaction(function (tx) {
            tx.executeSql("SELECT * FROM TOC ORDER BY id;", [], function (tx, res) {

                var numRows = res.rows.length;
                var html = '';
                for (var i = 0; i < numRows; i++) {
                    html += '<div><a href="#" onclick="app.loadArticle(' + res.rows.item(i).id + '); return false">' + res.rows.item(i).title + '</a><p>' + res.rows.item(i).dscr + '</p></div>';
                }
                $('#divTOC').html(html).show();
                $('#deviceready').hide();
            });
        });
    },

    // Update DOM on a Received Event
    receivedEvent: function(id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        console.log('Received Event: ' + id);
    }
};
