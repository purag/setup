Phoenix.set({
  openAtLogin: true
});

var w = Window;
var s = Screen;
var m = Mouse;
var k = Key;
var e = Event;

var INCREMENT = 50;
var PADDING = 5;
var MOD = ["shift", "cmd"];
var ALTMOD = ["alt", "shift"];

var HINT_APPEARANCE = "dark";
var HINT_BUTTON = "space";
var HINT_CANCEL = "escape";
var HINT_CHARS = "FJDKSLAGHRUEIWOVNCM";

// DIRECTIONS
var F  = "fill";
var N  = "north";
var S  = "south";
var W  = "west";
var E  = "east";
var NW = "nw";
var NE = "ne";
var SW = "sw";
var SE = "se";

// KEYS + DIRECTION MAPPINGS
var snap_cells = {
  "a": 0,
  "s": 1,
  ";": 2,
  "'": 3,
  "z": 4,
  "x": 5,
  ".": 6,
  "/": 7
};
var snap_start_cell = "";

var size_dirs = {
  "h": W,
  "j": S,
  "k": N,
  "l": E
};

var space_dirs = {
  ",": W,
  ".": E
};

// +---------+
// | HELPERS |
// +---------+
function curw () {
  return w.focused();
}

// Conditional key binding -- execute cb only if cond_f returns truthy
function onif (cond_f, key, modifiers, cb) {
  k.on(key, modifiers, function () {
    if (!cond_f()) return;
    cb();
  });
};

// Screen prototype extension -- subtract padding
s.prototype.width = function () {
  return this.flippedVisibleFrame().width - PADDING * 2;
};

s.prototype.height = function () {
  return this.flippedVisibleFrame().height - PADDING * 2;
};

s.prototype.origin = function () {
  return {
    x: this.flippedVisibleFrame().x + PADDING,
    y: this.flippedVisibleFrame().y + PADDING
  };
};

function opposite (dir) {
  switch (dir) {
    case N: return S;
    case S: return N;
    case E: return W;
    case W: return E;
    case NW: return SE;
    case NE: return SW;
    case SW: return NE;
    case SE: return NW;
  }
}

// Snap a window in a given direction
w.prototype.to = function (dir) {
  var screen = this.screen();
  var frame = {};
  frame.x = screen.origin().x;
  frame.y = screen.origin().y;
  frame.width = (screen.width() - PADDING) / 2;
  frame.height = (screen.height() - PADDING) / 2;

  if ([E, NE, SE].indexOf(dir) > -1) frame.x += screen.width() - frame.width;
  if ([SE, SW].indexOf(dir) > -1)    frame.y += screen.height() - frame.height;
  if (dir === F)                     frame.width = screen.width();
  if ([F, E, W].indexOf(dir) > -1)   frame.height = screen.height();

  this.setFrame(frame);
};

w.prototype.positionInGrid = function (cells, start, end) {
  var cols = ~~(cells / 2);
  var screen = this.screen();
  var cellwidth = (screen.width() - ((cols - 1) * PADDING)) / cols;
  var cellheight = (screen.height() - PADDING) / 2;

  var startc = start % cols,
    startw = ~~(start / cols),
    startl = screen.origin().x + (cellwidth + PADDING) * startc,
    startt = screen.origin().y + (cellheight + PADDING) * startw,
    startr = startl + cellwidth,
    startb = startt + cellheight;

  var endc = end % cols,
    endw = ~~(end / cols),
    endl = screen.origin().x + (cellwidth + PADDING) * endc,
    endt = screen.origin().y + (cellheight + PADDING) * endw,
    endr = endl + cellwidth,
    endb = endt + cellheight;

  var frame = this.frame();
  frame.x = Math.min(startl, endl);
  frame.y = Math.min(startt, endt);
  frame.width = Math.max(startr, endr) - frame.x;
  frame.height = Math.max(startb, endb) - frame.y;
  this.setFrame(frame);
}

// Resize a window by coeff units in the given direction
// coeff: -n shrinks by pixels units, +n grows by n pixels.
w.prototype.resize = function (dir, coeff) {
  var frame = this.frame();

  if (dir === W)                frame.x += coeff * -1;
  if (dir === N)                frame.y += coeff * -1;
  if ([E, W].indexOf(dir) > -1) frame.width += coeff;
  if ([N, S].indexOf(dir) > -1) frame.height += coeff;

  this.setFrame(frame);
};

w.prototype.toSpace = function (dir) {
  var curSpace = this.spaces()[0];
  var newSpace = curSpace.next();
  if (dir === W) newSpace = curSpace.previous();

  curSpace.removeWindows([this]);
  newSpace.addWindows([this]);
  this.focus();
};

// Snap bindings
for (var key in snap_cells) {
  onif(curw, key, MOD, function (cell) {
    if (snap_start_cell === "") {
      snap_start_cell = cell;
      setTimeout(function () {
        snap_start_cell = "";
      }, 500);
    } else {
      curw().positionInGrid(8, snap_start_cell, cell);
      snap_start_cell = "";
    }
  }.bind(null, snap_cells[key]));
}

// Resize bindings
for (var key in size_dirs) {
  onif(curw, key, MOD, function (dir) {
    curw().resize(dir, INCREMENT);
  }.bind(null, size_dirs[key]));

  onif(curw, key, ALTMOD, function (dir) {
    curw().resize(dir, -INCREMENT);
  }.bind(null, opposite(size_dirs[key])));
}

for (var key in space_dirs) {
  onif(curw, key, ALTMOD, function (dir) {
    curw().toSpace(dir);
  }.bind(null, space_dirs[key]));
}

// Hints
var hintsActive = false;
var hintkeys = [];
var hints = {};
var escbind = null;
var bsbind = null;

function cancelHints () {
  for (var activator in hints) {
    hints[activator].modal.close();
  };
  k.off(escbind);
  k.off(bsbind);
  hintkeys.map(k.off);
  hints = {};
  hintkeys = [];
  hintsActive = false;
}

function showHints (windows, prefix) {
  prefix = prefix || "";

  if (windows.length > HINT_CHARS.length) {
    var partitionSize = Math.floor(windows.length / HINT_CHARS.length);
    let lists = Object.values(windows.reduce((acc, curVal, curIdx, arr, k = curIdx % HINT_CHARS.length) => ((acc[k] || acc[k] = []).push(curVal), acc), {}));
    for (var j = 0; j < HINT_CHARS.length; j++) {
      showHints(lists[j], prefix + HINT_CHARS[j]);
    }
    return;
  }

  windows.forEach(function (win, i) {
    var helper = "";
    if (win.app().windows().length > 1) {
      helper += "  |  " + win.title().substr(0, 15) + (win.title().length > 15 ? "…" : "");
    }
    var hint = buildhint(prefix + HINT_CHARS[i] + helper, win);

    var activators = Object.keys(hints);
    for (var l = 0; l < activators.length; l++) {
      var hint2 = hints[activators[l]].modal;
      if (
        hint.origin.x < hint2.origin.x + hint2.frame().width + PADDING
        && hint.origin.x + hint.frame().width > hint2.origin.x - PADDING
        && hint.origin.y < hint2.origin.y + hint2.frame().height + PADDING
        && hint.origin.y + hint.frame().width > hint2.origin.y - PADDING
      ) {
        hint.origin = {
          x: hint.origin.x,
          y: hint2.origin.y + hint2.frame().height + PADDING
        };
        l = -1;
      }
    }
    
    hints[prefix + HINT_CHARS[i]] = {
      win: win,
      modal: hint,
      position: 0,
      active: true
    };
  });
  escbind = k.on(HINT_CANCEL, [], cancelHints);
  hintsActive = true;
}

k.on(HINT_BUTTON, MOD, function () {
  if (hintsActive) {
    cancelHints();
  } else {
    showHints(w.all({
      visible: true
    }));
    var sequence = "";
    HINT_CHARS.split("").forEach(function (hintchar) {
      hintkeys.push(k.on(hintchar, [], function () {
        sequence += hintchar;
        for (var activator in hints) {
          var hint = hints[activator];
          if (!hint.active) continue;
          if (activator[hint.position] === hintchar) {
            hint.position++;
            if (hint.position === activator.length) {
              hint.win.focus();
              m.move({
                x: hint.modal.origin.x + hint.modal.frame().width / 2,
                y: s.all()[0].frame().height - hint.modal.origin.y - hint.modal.frame().height / 2
              });
              return cancelHints();
            }
            hint.modal.text = hint.modal.text.substr(1);
          } else {
            hint.modal.close();
            hint.active = false;
          }
        }
      }));
    });
    bsbind = k.on("delete", [], function () {
      if (!sequence.length) cancelHints();
      var letter = sequence[sequence.length - 1];
      sequence = sequence.substr(0, sequence.length - 1);
      for (var activator in hints) {
        var hint = hints[activator];
        if (hint.active) {
          hint.position--;
          hint.modal.text = letter + hint.modal.text;
        } else if (activator.substr(0, sequence.length) === sequence) {
          hint.modal.show();
          hint.active = true;
        }
      }
    });
  }
});

e.on("mouseDidLeftClick", cancelHints);

function buildhint (msg, win) {
  var wf = win.frame();
  var wsf = win.screen().frame();
  var modal = Modal.build({
    text: msg,
    appearance: HINT_APPEARANCE,
    icon: win.app().icon(),
    weight: 16
  });
  var mf = modal.frame();
  modal.origin = {
    x: Math.min(
      Math.max(wf.x + wf.width / 2 - mf.width / 2, wsf.x),
      wsf.x + wsf.width - mf.width
    ),
    y: Math.min(
      Math.max(s.all()[0].frame().height - (wf.y + wf.height / 2 + mf.height / 2), wsf.y),
      wsf.y + wsf.height - mf.height
    )
  };
  modal.show();
  return modal;
}

Phoenix.notify("Configuration loaded.");

// link this file in ~ if we're on macos
// purag/.files!darwin-link
