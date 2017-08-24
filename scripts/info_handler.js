'use strict';
var async = require("async");
var moment = require("moment");
var fs = require('fs');
var contest = require("./contests_handler.js");
var jsonfile = require("jsonfile");

var config_file_path = "./config.json";
var msgs_file_path = "./slack_msgs.json";

var config = JSON.parse(fs.readFileSync(config_file_path,"utf-8"));
var msgs = JSON.parse(fs.readFileSync(msgs_file_path,"utf-8"));

var timer;
var version = "1.0.0";
var DEBUG = false
var is_running = false;
var bot_name = "atcoder-info";

module.exports = (robot) => {
  robot.hear(bot_name + " " + config["on_cmd"],(msg) => {
    if(is_running){
      msg.send(msgs["alredy_on"]);
    }else{
      is_running = true;
      msg.send(msgs["on"].replace("<ver>",config["version"]));
      msg.send(msgs["intro"].replace("<bot_name>",config["bot_name"]));
      timer = setInterval(function(){set_check_interval(msg);},1000);
    }
  });

  robot.hear(bot_name + " " + config["off_cmd"],(msg) => {
    if(is_running){
      msg.send(msgs["off"]); 
      is_running = false;
      clearInterval(timer);
    }
  });

  robot.hear(bot_name + " " + config["debug_cmd"],(msg) => {
    DEBUG = !DEBUG;
    if(DEBUG){
      msg.send(msgs["debug_mode"]);
    }else{
      msg.send(msgs["non_debug_mode"]); 
    }
  });

  robot.hear(bot_name + " " + config["seting_update_cmd"],(msg) => {
    var args = msg.message.text.replace(bot_name + " " + config["seting_update_cmd"] + " ","");
    var key = args.split(" ")[0];
    var new_value = args.replace(key + " ","");
    var n_value = Number(new_value);
    if(n_value){
      new_value = n_value;
    }

    if(config[key]){
      config[key] = new_value;
      jsonfile.writeFile(config_file_path, config, {encoding:"utf-8"});
      config = JSON.parse(fs.readFileSync(config_file_path,"utf-8"));
    }else if(msgs[key]){
      msgs[key] = new_value;
      jsonfile.writeFile(msgs_file_path, config, {encoding:"utf-8"});
      msgs = JSON.parse(fs.readFileSync(msgs_file_path,"utf-8"));
    }else{
      msg.send(msgs["not_found_key"].replace("<key>",key)); 
      return;
    }

    msg.send(msgs["setting_save"].replace("<key>",key).replace("<value>",new_value));

    if(DEBUG){
      console.log("seting update " + moment().format("YYYY/MM/DD hh:mm"));
      console.log(config);
      console.log("");
    }
  });

  robot.hear(config["show_config_cmd"],(msg)=>{
    var config_data = "";

    for(var key in config){
      config_data += key + " : " + config[key] + "\n";
    }

    msg.send(config_data);
  });

  robot.hear(config["msgs_config_cmd"],(msg)=>{
    var msgs_data = "";

    for(var key in msgs){
      msgs_data += key + " : " + config[key] + "\n";
    }

    msg.send(msgs_data);
  });
};

function set_check_interval(msg){
  if(is_running){
    var now = moment();
    if(Number(now.format("mm")) % 5 == 0){ //5分周期に合わせる
      if(DEBUG){
        console.log("seting interval " + now.format("YYYY/MM/DD hh:mm")); 
      }
      update_check();
      info_check(msg);
      setInterval(function(){update_check();},config["update_interval"]); //1h
      setInterval(function(){info_check(msg);},config["info_check_interval"]); //5m
      clearInterval(timer);
    }
  }
};

function befor_info_target(){
  if(is_running){
    var fc = contest.get();
    var now = moment();
    var target = new Array();
    for(var i = 0;i < fc.length;i++){
      if(now.format("YYYY/MM/DD") == fc[i]["date"].match(/\d...\/\d.\/\d./)[0]){
        if(Number(now.format("HH")) + Number(now.format("mm")) == config["info_h"]){
          target.push({"name":fc[i]["name"],
                       "date":fc[i]["date"],
                       "url":fc[i]["url"],
                       "time":fc[i]["time"]});
          if(DEBUG){
            console.log("geted info target " + now.format("YYYY/MM/DD hh:mm")); 
            console.log(target);
          }
        }
      }
    }
  }
  return target;
};

function info_check(msg){
  if(is_running){
    var now = moment();
    if(DEBUG){
      console.log("info_checking " + now.format("YYYY/MM/DD hh:mm")); 
    }
    var names = "<";
    var date;
    var targets = befor_info_target();
    var del_contests = new Array();
    var start_mtime,start_mstime,finish_mstime;
    for(var i = 0;i < targets.length;i++){
      names += targets[i]["url"] +"|" + targets[i]["name"] + "> , <";
      date = targets[i]["date"];
      del_contests.push(targets[i]["name"]);

      var time = targets[i]["date"].match(/\d+:\d+/)[0].split(":");
      start_mstime = ((Number(time[0]) * 60) + Number(time[1]) - (config["info_h"] * 60)) * 60 * 1000;
      finish_mstime = start_mstime + Number(targets[i]["time"]) * 60 * 1000;

      if(DEBUG){
        console.log("timer set");
        console.log("start-mstime:" + start_mstime);
        console.log("finish-mstime:" + finish_mstime);
        console.log(moment().format("YYYY/MM/DD hh:mm") + "\n");
      }

      start_info_timer = setTimeout(function(msg,name,url){
        start_info(msg,name,url);
      },start_mstime,msg,targets[i]["name"],targets[i]["url"]);

      finish_info_timer = setTimeout(function(msg,name){
        finish_info(msg,name);
      },finish_mstime,msg,targets[i]["name"]);
    }

    if(targets.length){
      msg.send(msgs["befor_info"]
                   .replace("<name>",names.slice(0,-3))
                   .replace("<date>",date.match(/\d+:\d+/)[0]));
      contest.del(del_contests);
    }
  }
}

function update_check(){
  if(is_running){
    if(DEBUG){
      console.log("update checking " + moment().format("YYYY/MM/DD hh:mm")); 
    }
    contest.update();
  }
}

function start_info(msg,name,url){
  msg.send(msgs["start_info"].replace("<name>",name).replace("<url>",url));
}

function finish_info(msg,name){
  msg.send(msgs["finish_info"].replace("<name>",name));
}
