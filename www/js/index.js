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
var baseURL = 'https://raw.githubusercontent.com/mgolkowski/WorldVisionApp/master/www/';

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

        alert('STARTING v2. ...');
        
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

                    alert('num rows: ' + numRows);

                    if (numRows == 0) { // no row =first time - set last update to 1900 to force initial refresh
                        alert('COUNT = 0 - about to insert');
                        tx.executeSql("INSERT INTO LastTOCUpdate (lastUpdate) VALUES (?)", ["1900-01-01"], function (tx, res) {
                            

                            app.getServerTOCUpdate("1900-01-01");

                        }, function (e) {
                            alert("ERROR: " + e.message);
                        });

                    } else { // already has a row - read it
                        alert('already has a row - read it ...');

                        db.transaction(function (tx) {
                            alert('reading ...');
                            tx.executeSql("SELECT lastUpdate from LastTOCUpdate;", [], function (tx, res) {
                                alert('done reading.');

                                var retval = res.rows.item(0).lastUpdate;
                                alert('result: ' + retval);

                                app.doServerTOCUpdate(retval);

                            }, function (e) {
                                alert("ERROR: " + e.message);
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
        alert('about to retrieve from: ' + baseURL + 'LastTOCUpdate.xml');
        $.ajax({
            url: baseURL + 'LastTOCUpdate.xml',
            dataType: "xml",
            contentType: 'application/xml',
            timeout: 10000,
            type: 'POST',
            success: function (data) {

                alert(data);
                var xmlDoc = $.parseXML(data),
                $xml = $(xmlDoc),
                $lastUpdate = $xml.find("lastUpdate");

                alert('LAST UPDATE FROM SERVER: ' + $lastUpdate.text());


            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                alert("Error status :" + textStatus);
                alert("Error type :" + errorThrown);
                alert("Error message :" + XMLHttpRequest.responseXML);
            }
        });
    },

    setupDatabase: function () {
        alert('in setupdb: ' + db);
        db.transaction(function (tx) {

            alert('in db.transaction');

            //tx.executeSql('DROP TABLE IF EXISTS test_table');
            tx.executeSql('CREATE TABLE IF NOT EXISTS test_table (id integer primary key, data text, data_num integer)');

            tx.executeSql("INSERT INTO test_table (data, data_num) VALUES (?,?)", ["test", 100], function (tx, res) {
                db.transaction(function (tx) {

                    tx.executeSql("INSERT INTO test_table (data, data_num) VALUES (?,?)", ["test", 100], function (tx, res) {
                        alert("insertId: " + res.insertId + " -- probably 1");
                        alert("rowsAffected: " + res.rowsAffected + " -- should be 1");

                        db.transaction(function (tx) {
                            tx.executeSql("select count(id) as cnt from test_table;", [], function (tx, res) {
                                alert("res.rows.length: " + res.rows.length + " -- should be 1");
                                alert("res.rows.item(0).cnt: " + res.rows.item(0).cnt + " -- should be 1");
                            });
                        });

                    }, function (e) {
                        alert("ERROR: " + e.message);
                    });
                }); ("insertId: " + res.insertId + " -- probably 1");

                alert("rowsAffected: " + res.rowsAffected + " -- should be 1");

                db.transaction(function (tx) {
                    tx.executeSql("select count(id) as cnt from test_table;", [], function (tx, res) {
                        alert("res.rows.length: " + res.rows.length + " -- should be 1");
                        alert("res.rows.item(0).cnt: " + res.rows.item(0).cnt + " -- should be 1");
                    });
                });

            }, function (e) {
                alert("ERROR: " + e.message);
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
