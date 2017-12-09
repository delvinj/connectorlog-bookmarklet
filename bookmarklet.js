/* :noTabs=true:mode=javascript:tabSize=4:indentSize=4:folding=indent: */

/* inRiver extension log bookmarklet      */
/* author: djohnson - Aware Web Solutions */

javascript:try{
    
(function () {
    var _connectors;
    var _win;
    var _doc;
    var _output;
    var _topItemHash;  /* hashcode of the JSON string for the TOP item. helps optimize the display since log messages don't have unique IDs. */
    var _table;
    
    /* string hashcode ala java */
    function hashCode(str) {
        let len = str.length;
        let hash = 0;
        for (var j=0; j < len; ++j) {
            let ch = str.charCodeAt(j);
            hash = ((hash << 5) - hash) + ch;
            hash = hash & hash;
        }
        return hash;
    }
    
    function addStyles(document) {
        document.write("<style type='text/css'>\
              body { height:100%; overflow: hidden; margin:0; padding:0; }                                                                                                       \
              input, label, select, button, * { font: 500 12px/12px calibri, sans-serif; }                                                                                       \
              input[type='checkbox'] { margin: 0; vertical-align: middle; line-height:12px; }                                                                                    \
              body.loading { background: #c0ffEE !important; }                                                                                                                   \
              body.loading select { color: #666 !important; }                                                                                                                    \
              label { font-weight: bold; margin: 0 5px; vertical-align: middle; }                                                                                                \
              label u { font-weight: bold; }                                                                                                                                     \
              form { box-shadow: 1px 2px 4px 2px rgba(0,0,0,.3); background: rgb(160,198,232); padding: 5px; height: 28px; margin: 0; box-sizing: border-box; }                  \
              form select { min-width: 270px; }                                                                                                                                  \
              form button { line-height: 12px;margin: 0 5px;vertical-align: middle;}                                                                                             \
              form .form-group { vertical-align: middle; margin: 0; box-sizing: border-box; float: right; line-height: 12px; }                                                   \
              #output { position: absolute; box-sizing:border-box; height: calc(100% - 30px); top: 30px; width: 100%; overflow: auto; border-top: solid 1px hsl(0, 0%, 80%); }   \
              td.time { min-width: 100px; color:#777; }                                                                                                                          \
              td { font: bold 10px/12px consolas, monospace, sans-serif; }                                                                                                       \
              tr.error td { color: red !important; font-weight: bold; }                                                                                                          \
              table.errors-only tr:not(.error) { display: none; }                                                                                                                \
              td.hash { color: #363636; display: none; }                                                                                                                         \
              a.entity { color: darkblue; text-decoration: underline; }                                                                                                          \
        </style>");
    }
    
    function addForm(document) {
        /* Chrome uses Alt+E for its main menu; thus the non-obvious choice of "S" for showing errors. */
        document.write(
            "<form>                                                                                                             \
               <label for=connector><u>C</u>onnector</label>                                                                    \
               <select disabled=1 accesskey=\"C\" id=\"connector\"><option value=\"\">Choose a Connector...</option></select>   \
               <div class=form-group>                                                                                           \
                 <input disabled=1 accesskey=\"S\" type=checkbox id=cb-errors />                                                \
                 <label for=cb-errors>Just Error<u>s</u></label>                                                                \
                 &nbsp;|&nbsp;                                                                                                  \
                 <button disabled=1 id=\"refresh\" accesskey=\"R\"><u>R</u>efresh</button>                                      \
               </div>                                                                                                           \
            </form>");
        document.write("<div id=output><table><tbody id=initial-body></tbody></table></div>");
    }
    
    function sendQuery(url, callback) {
        var req = new XMLHttpRequest();
        req.open("GET", url, true);
        req.addEventListener("load", callback.bind(req));
        req.send("");
    }
    
    /* kick off a request for connector events JSON file */
    function beginGetConnector(name, max) {
        max = max || 300;
        
        let url = "/api/connectorevent/?id={id}&maxNumberOfEvents={max}";
        url = url.replace(/\{id\}/g, name)
                 .replace(/\{max\}/g, max);
        
        _doc.body.classList.add("loading");
        
        sendQuery(url, function (ev) {
            _doc.body.classList.remove("loading");
            
            let data = JSON.parse(this.response).map((item)=>{
                /* Add hashcode to each item from the server, which we treat as unique ID for the log message. */
                item.hash = hashCode(JSON.stringify(item));
                return item;
            });
            
            /* Create the table */
            writeConnectorData(data);
        });
    }
    
    function initForm() {
        let document = _doc;
        let list = document.getElementById("connector");
        list.removeAttribute("disabled");
        _connectors.forEach(item => {
            list.add(new Option(item.Id, item.Id));
        });
        list.addEventListener("change", (ev) => {
            while (_table.tBodies.length > 1) {
                _table.removeChild(_table.tBodies[0]);
            }
            if (!list.value) {
                writeConnectorData(false);
            } else {
                _win.location.hash = "#" + list.value;
            }
        });
        _output = document.getElementById("output");
        _table = _output.querySelector("table:first-child");
        _doc.getElementById("refresh").removeAttribute("disabled");
        _doc.getElementById("cb-errors").removeAttribute("disabled");
        _doc.getElementById("cb-errors").addEventListener("click", (ev) => {
            _table.classList.toggle("errors-only");
        });
    }
    
    /* open the window and write out the HTML. */
    _win = window.open("", "logs", "width=800,height=500,status=0,toolbars=0");
    _doc = _win.document;
    _doc.open();
    addStyles(_doc);
    addForm(_doc);
    _doc.close();
    
    /* F5 key refreshes the log. */
    _doc.addEventListener("keydown", (ev) => {
        if (ev.keyCode === 116) {
            ev.preventDefault();
            _doc.getElementById("refresh").click();
        }
    }, false);
    
    /* Refresh button refreshes the log. */
    _doc.getElementById("refresh").addEventListener("click", ev => {
        ev.preventDefault();
        let name = _win.location.hash.substring(1);
        beginGetConnector(name,100);
    });
    
    function writeConnectorData(data) {
        if (!data || data.length === 0) {
            return;
        }
        let document = _doc;
        
        /* create a table body element that is initially not attached to the DOM */
        let tbody = document.createElement("tbody");
        
        if (_topItemHash) {
            /* scan DOWN the list of new log items and compare hashcodes with the currently shown rows. */
            for (var j=0; j < data.length; ++j) {
                if (data[j].hash === _topItemHash) {
                    if (j === 0) {
                        /* The list has not changed since last update. */
                        return;
                    } else {
                        /* The list has |j| new elements since last update. */
                        data = [].slice.call(data, 0, j);
                        break;
                    }
                }
            }
        }
        
        /* insert rows */
        data.forEach(function (item) {
            let row = tbody.insertRow(-1);
            /* the first cell is invisible and used for debugging the script. */
            row.insertCell(-1).innerHTML = item.hash.toString(16).toUpperCase();
            row.insertCell(-1).innerHTML = item.EventTime;
            row.insertCell(-1).innerHTML = item.Message;
            if (item.IsError) {
                row.classList.add("error");
            }
            row.cells[0].classList.add("hash");
            row.cells[1].classList.add("time");
        });
        
        let spacer = document.createElement("tbody");
        spacer.className = "spacer";
        spacer.innerHTML = "<tr><td colspan=9>----</td></tr>";
        
        _table.insertBefore(spacer, _table.tBodies[0]);
        _table.insertBefore(tbody, spacer);
        
        /* update bookkeeping */
        _topItemHash = data[0].hash;
    }
    
    /* switches to a different connector */
    _win.addEventListener("hashchange", function (ev) {
        let name = ev.newURL.split(/#/);
        name.shift();
        name = name.join("#");
        beginGetConnector(name, 500);
    });
    
    /* start by loading the list of connectors and updating the form elements */
    sendQuery("/api/connector/?inbounds=true&outbounds=true", function (ev) {
        _connectors = JSON.parse(this.response);
        initForm();
    });
    
}());

}catch(x){alert(x);}void 0