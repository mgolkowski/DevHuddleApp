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

        alert('STARTING ...');
        
        app.receivedEvent('deviceready');
        db = window.sqlitePlugin.openDatabase({ name: "my.db" });

        alert(' getLastContentsUpdate(): ' + app.getLastContentsUpdate());
        //app.setupDatabase();
    },

    // Reads the last update timestamp of the table of contents from the database
    // If never updated (first time) then set it to 1900-01-01 to force initial refresh
    getLastContentsUpdate: function () {

        db.transaction(function (tx) {


            tx.executeSql('CREATE TABLE IF NOT EXISTS LastTOCUpdate (lastUpdate text)');

            var numRows = 0;
            db.transaction(function (tx) {
                tx.executeSql("select count(id) as cnt from test_table;", [], function (tx, res) {
                    numRows = res.rows.item(0).cnt;
                });
            });

            alert('num rows: ' + numRows);

            if (numRows == 0) { // first time - set last update to 1900 to force initial refresh
                alert('about to insert row');
                tx.executeSql("INSERT INTO LastTOCUpdate (lastUpdate) VALUES (?)", ["1900-01-01"]);
            } else {
                alert('already has a row!');
            }

            db.transaction(function (tx) {
                tx.executeSql("select top 1 lastUpdateText as lastUpdate from LastTOCUpdate;", [], function (tx, res) {
                    return res.rows.item(0).lastUpdate;
                });
            });
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
