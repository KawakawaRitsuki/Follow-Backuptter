'use strict';
var configRoutes;
var twitter = require('twitter');var twitter = require('twitter');
var async = require('async');

configRoutes = function(app, server, passport) {

  app.get("/", function(req, res, next){
    res.render("login", {});
  });

  app.get('/auth/twitter', passport.authenticate('twitter'));

  app.get('/auth/twitter/callback', passport.authenticate('twitter', { successRedirect: '/list', failureRedirect: '/' }));

  app.get('/list',function(req,res){
    if(!req.hasOwnProperty("user")) {res.redirect("/"); return;}
    res.render("index",{});
  });

  app.get('/api/list', function(req, res){
    if(!req.hasOwnProperty("user")) {res.redirect("/"); return;}
    if(req.session.hasOwnProperty("list")) {res.send(req.session.list); return;}

    var client = new twitter({
        consumer_key:        process.env.CONSUMER_KEY,
        consumer_secret:     process.env.CONSUMER_SECRET,
        access_token_key:    req.user.token,
        access_token_secret: req.user.tokenSecret,
    });
    var cursor = -1;
    var users = [];
    
    var done = function(u,c){
      cursor = c;
      users = u;
      console.log("next_cursor:" + c);

      if(c == 0){
        getLookup(client,users,function(usersData){
          console.log("RETURN");
          req.session.list = usersData;
          res.send(usersData);
        });
      }else{
        getIds(client,cursor,users,done);
      }
    };

    getIds(client,cursor,users,done);
  });

  //next_cursor

  function getIds(client,cursor,users,done){
    client.get('friends/ids', {"stringify_ids":true,"cursor":cursor}, function(error, data, response){
      if (!error) {
         Array.prototype.push.apply(users,data.ids);
         done(users,data.next_cursor);
       };
    });
  };

  function getLookup(client,users,done){
    var b = users.length, cnt = 100,newArr = [];
    for(var i = 0; i < Math.ceil(b / cnt); i++) {
      var j = i * cnt;
      var p = users.slice(j, j + cnt);
      newArr.push(p);
    }

    var process = []
    newArr.forEach(function(element,index,array){
      process.push(function(callback){
        client.get('users/lookup',{user_id:element.join(',')},function(e,d,r){
          callback(e,d);
        });
      });
    });

    async.series(process,function(err,results){
      if(err) throw err;
      var res = [];
      results.forEach(function(u){
        Array.prototype.push.apply(res,u);
      });
      done(res);
    });
  }

  app.get('/api/reload', function(req, res){
    if(!req.hasOwnProperty("user")) {res.redirect("/"); return;}

    var client = new twitter({
        consumer_key:        process.env.CONSUMER_KEY,
        consumer_secret:     process.env.CONSUMER_SECRET,
        access_token_key:    req.user.token,
        access_token_secret: req.user.tokenSecret,
    });
    client.get('friends/ids', {}, function(error, data, response){
      if (!error) {
         var b = data.ids.length, cnt = 100,newArr = [];
         for(var i = 0; i < Math.ceil(b / cnt); i++) {
           var j = i * cnt;
           var p = data.ids.slice(j, j + cnt);
           newArr.push(p);
         }
         var process = []

         newArr.forEach(function(element,index,array){
           process.push(function(callback){
             client.get('users/lookup',{user_id:element.join(',')},function(e,d,r){
               callback(e,d);
             });
           });
         });

         async.series(process,function(err,results){
           if(err) throw err;
           var users = [];
           results.forEach(function(u){
             Array.prototype.push.apply(users,u);
           });
           req.session.list = users;
           res.send(users);
         });
       }
    });
  });

  
  app.get('/api/user_data',function(req,res){
    if(!req.hasOwnProperty("user")) {res.redirect("/"); return;}
    res.send(req.user._json);
  });

  app.get('/api/csv',function(req,res){
    if(!req.hasOwnProperty("user")) {res.redirect("/"); return;}
    if(!req.session.hasOwnProperty("list")) {res.redirect("/"); return;}
    var csv = "\u{feff}name,screen_name,id\n";
    req.session.list.forEach(function(user){
      csv = csv + user.name + "," + user.screen_name + "," + user.id + "\r\n";
    });
    res.setHeader('Content-disposition', 'attachment; filename=follow_list.csv');
    res.setHeader('Content-type', 'text/csv');
    res.send(csv);
  });

  app.get('/api/logout',function(req,res){
    req.session.destroy();
    res.redirect("/");
  });
 
}

module.exports = {configRoutes: configRoutes};