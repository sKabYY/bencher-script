var fs = require('fs');

var config = require(__dirname + '/../config.json');

var url_dict = require(__dirname + '/../' + config.urls);

var doT = require(__dirname + '/doT.js');
tpl = doT.template(fs.readFileSync(__dirname + '/tpl.html'));

Object.keys(url_dict).forEach(g => {
  var urls = url_dict[g];
  var ro = {
    name: g,
    results: []
  };
  var out_dir = config.out_dir + g + '/';
  Object.keys(urls).forEach(uk => {
    var files = fs.readdirSync(out_dir);
    var res_every_concurrency = files.filter(f => {
      var file_matcher = new RegExp(g + '-' + uk + '-\\d+.txt');
      return file_matcher.test(f);
    }).map(file => {
      var file_path = out_dir + file;
      try {
        var r = createRes(fs.readFileSync(file_path).toString());
      } catch (e) {
        // console.log(e);
        console.log('parse file [%s] failed.', file_path);
        r = {
          clients: -1
        }
      }
      r.out_file = './' + g + '/' + file;
      return r;
    }).sort((r1, r2) => {
      return r1.clients - r2.clients;
    });

    ro.results.push({
      action: uk,
      result: res_every_concurrency.filter(r => r.clients != -1)
    });
  });
  fs.writeFileSync(config.out_dir + g + '-report.html', tpl(ro));
});


function createRes(cnt) {
  cnt = cnt.replace(/\r\n/g, '\n');
  var matcher = /(.*?):\s*?(.*?)\n/g;

  var rx = {};
  var mr;
  while ((mr = matcher.exec(cnt))) {
    var k = mr[1],
      v = mr[2].trim();
    if (mr[1] == 'Time per request' && mr[2].indexOf('across') != -1) {
      k = 'Time per request2';
    }
    rx[k] = v;
  }

  r = {
    server_name: rx['Server Software'],
    clients: rx['Concurrency Level'],
    duration: rx['Time taken for tests'],
    total: rx['Total transferred'],
    rate: (rx['Transfer rate'] || '').replace(' received', ''),
    qps: (rx['Requests per second'] || '').replace(' [#/sec] (mean)', ''),
    avg_res_time: (rx['Time per request'] || '').replace(' [ms] (mean)', ''),
    avg_server_time: (rx['Time per request2'] || '').replace(' [ms] (mean, across all concurrent requests)', ''),
    requests: {
      failed: rx['Failed requests'],
      completed: rx['Complete requests']
    }
  };

  // 网络上消耗的时间的分解
  r.conn_time = {};

  ['Connect', 'Processing', 'Waiting', 'Total'].forEach((ct) => {
    var values = rx[ct].split(/\s+/g);
    r.conn_time[ct.toLocaleLowerCase()] = {
      min: values[0],
      mean: values[1],
      mean2: values[2],
      median: values[3],
      max: values[4]
    }
  })

  // 每个请求处理时间的分布情况
  var per_matcher = /(\d+[\%]{1}).*?(\d+)/g;
  var pmr;
  r.rate_by_time = {};
  while (pmr = per_matcher.exec(cnt)) {
    r.rate_by_time[pmr[1]] = pmr[2];
  }

  return r;
}