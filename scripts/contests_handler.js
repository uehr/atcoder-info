var client = require("cheerio-httpcli");
var async = require("async");
var fs = require('fs');
var jsonfile = require("jsonfile");
var moment = require("moment");

var atcoder_url = "https://atcoder.jp/contest";
var fc_file_path = "./contests_data.json";
var config_file_path = "./config.json";

var name_match = /AtCoder ([_0-9a-zA-Z]+) Contest \d../; 
var url_match = /https:\/\/a.c\d..\.contest\.atcoder\.jp/;
var date_match = /\d...\/\d.\/\d. \d.:\d./;
var time_match = />\d.:\d.</;

var config = JSON.parse(fs.readFileSync(config_file_path,"utf-8"));
var fc; //future_contests

function fc_update(){
  fc = (JSON.parse(fs.readFileSync(fc_file_path,"utf-8")))["contests"];
}

exports.get = function(){
  fc_update();
  return fc;
}

exports.save = function(contests){
  jsonfile.writeFile(fc_file_path, {"contests":contests}, {encoding:"utf-8"});
}

exports.del = function(names){
  fc_update();
  console.log(fc);
  var length = fc.length;
  for(var i = 0;i < names.length;i++){
    for(var j = 0;i < length;j++){
     if(fc[j]["name"] == names[i]){
        fc.splice(j,1);
        break;
      }
    }
  }

  this.save(fc);
}

function is_passed_date(date){
  if(date.match(/\d...\/\d.\/\d./)[0] == moment().format("YYYY/MM/DD")){
    if(Number(date.match(/\d.:/)[0].replace(":","")) >= config["info_h"]){
      return true;
    }
  } 
  return false;
}

function is_saved_contest(name){
  fc_update();
  for(var i = 0;i < fc.length;i++){
    if(name == fc[i]["name"]){
      return true;
    }
  } 
  return false;
}

exports.update = function(){
  fc_update();
  var is_fc_data = false;
  async.waterfall([
    function(next){
      client.fetch(atcoder_url, {categories:"1%2C4%2C5",lang:"ja"},function (err, $, res) {
        if(err){
          msg.send(msgs["get_err"] + "\n" + err);
          process.exti(1);
        }else{
          var lines = $.html().split("\n");
          var fc_data = "";
          var cnt = 0;
          for(var i = 0; i < lines.length; i++){
            if(lines[i].match(/終了後のコンテスト/)){
              break; 
            }else if(lines[i].match(/予定されたコンテスト/)){
              is_fc_data = true;
            }

            if(is_fc_data){
              fc_data += lines[i];
            }
          }
          var names,dates,urls,times;
          names = fc_data.match(name_match);
          dates = fc_data.match(date_match);
          urls = fc_data.match(url_match);
          times = fc_data.match(time_match);

          for(var i = 0;i < fc_data.match(date_match).length;i++){
            var tmp = times[i].replace(/>|</g,"").split(":");
            var time = Number(tmp[0]) * 60 + Number(tmp[1]);
            if(is_passed_date(dates[i])){
              continue;
            }else if(is_saved_contest(names[i])){
              continue;
            }
            fc.push({"name":names[i], "date":dates[i], "url":urls[i], "time":time});
          }
        }
        next(fc);
      });
    }
  ],function(fc){
    jsonfile.writeFile(fc_file_path, {"contests":fc}, {encoding:"utf-8"});
  });
};

