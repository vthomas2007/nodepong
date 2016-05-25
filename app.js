var mongojs = require("mongojs");
var db = mongojs('localhost:27017/multiPong', []);

var express = require('express');
var app = express();
var server = require('http').Server(app);

var io = require('socket.io')(server, {});

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/client/index.html');
});

app.use('/client', express.static(__dirname + '/client'));
app.use('/client/styles', express.static(__dirname + '/client/styles'));

server.listen(2001);
console.log('Server Started.');

var SOCKET_LIST = {};

var GAME_WIDTH = 700;
var GAME_HEIGHT = 400;

var GAME = {
  player1: null,
  player2: null,
  ball: null
};

GAME.update = function() {
  if (GAME.ball && GAME.player1 && GAME.player2) {
    if (GAME.ball.x < GAME.player1.x + GAME.player1.width &&
        GAME.ball.x + GAME.ball.width > GAME.player1.x &&
        GAME.ball.y < GAME.player1.y + GAME.player1.height &&
        GAME.ball.y + GAME.ball.height > GAME.player1.y) {
          ball.toggleXDirection();
    }

    if (GAME.ball.x < GAME.player2.x + GAME.player2.width &&
      GAME.ball.x + GAME.ball.width > GAME.player2.x &&
      GAME.ball.y < GAME.player2.y + GAME.player2.height &&
      GAME.ball.y + GAME.ball.height > GAME.player2.y) {
        ball.toggleXDirection();
    }

    GAME.ball.update();
  }
};

GAME.onDisconnect = function(socket) {
  if (GAME.player1 && socket.id == GAME.player1.id)
    delete GAME.player1;
  else if (GAME.player2 && socket.id == GAME.player2.id)
    delete GAME.player2;
};

GAME.getUpdatePackage = function() {
  if (GAME.player1 && GAME.player2) {
    return {
      player1Score: GAME.player1.score,
      player2Score: GAME.player2.score
    };
  }
};

var Player = function(id) {
  var self = {
    id: id,
    x: 10,
    y: 180,
    width: 10,
    height: 80,
    score: 0
  };

  self.getUpdatepack = function() {
    return {
      x: self.x,
      y: self.y,
      width: self.width,
      height: self.height,
      score: self.score
    };
  };

  self.update = function() {
    if (self.y < 0)
      self.y = 0;
    if (self.y + self.height > GAME_HEIGHT)
      self.y = GAME_HEIGHT - self.height;
  };

  Player.list[id] = self;
  return self;
};

Player.list = {};

Player.onConnect = function(socket) {
  var player = Player(socket.id);
  socket.on('mouseMove', function(data) {
    player.y = data.y;
  });
  return player;
};

Player.onDisconnect = function(socket) {
  delete Player.list[socket.id];
};

Player.update = function() {
  var pack = [];
  for (var i in Player.list) {
    var player = Player.list[i];
    player.update();
    pack.push(player.getUpdatepack());
  }
  return pack;
};


var Ball = function() {
  var self = {
    x: 300,
    y: 300,
    width: 10,
    height: 10,
    xSpeed: 10,
    ySpeed: 10
  };

  self.toggleXDirection = function() {
    self.xSpeed *= -1
  };

  self.toggleYDirection = function() {
    self.ySpeed *= -1
  };

  self.update = function() {
    self.x += self.xSpeed;
    self.y += self.ySpeed;

    if (self.x < 0) {
      self.x = 0;
      self.toggleXDirection();
    } else if (self.x + self.width > 700) {
      self.x = 700 - self.width;
      self.toggleXDirection();
    }

    if (self.y < 0) {
      self.y = 0;
      self.toggleYDirection();
    } else if (self.y + self.height > 400) {
      self.y = 400 - self.height;
      self.toggleYDirection();
    }
  };

  return self;
};

var ball = new Ball();
GAME.ball = ball;

io.sockets.on('connection', function(socket) {
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;

  if (GAME.player1 === null) {
    var newPlayer = Player.onConnect(socket);
    newPlayer.x = 10;
    GAME.player1 = newPlayer;
    socket.emit('joinGameResponse', {success: true});
  }
  else if (GAME.player2 === null) {
    var newPlayer = Player.onConnect(socket);
    newPlayer.x = 680;
    GAME.player2 = newPlayer;
    socket.emit('joinGameResponse', {success: true});
  }
  else {
    socket.emit('joinGameResponse', {success: false});
  }

  socket.on('disconnect', function() {
    delete SOCKET_LIST[socket.id];
    GAME.onDisconnect(socket);
    Player.onDisconnect(socket);
  });
});

setInterval(function() {
  GAME.update();

  var pack = {
    player: Player.update(),
    ball: GAME.ball,
    game: GAME.getUpdatePackage()
  };

  for (var i in SOCKET_LIST) {
    var socket = SOCKET_LIST[i];
    socket.emit('update', pack);
  }
}, 1000 / 25);
