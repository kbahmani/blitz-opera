/*jslint
    onevar: false, undef: true, newcap: true, nomen: false, es5: true,
    regexp: true, plusplus: true, bitwise: false, browser: true, indent: 4 */
/*global $, Math, localStorage, opera */
var blitz = (function () {
    // var root = 'http://blitz.io/';
	var root = 'http://localhost:5000/';
    return {
        root: function () {
            return root;
        },
        about: function (cb) {
			var request = new XMLHttpRequest();
			request.open("GET", root + 'api/1/account/about', true);
			request.onreadystatechange = function () {
				if (request.readyState == 4 && request.status == 200) {
					var data = JSON.parse(request.responseText);
					cb(data);
				}
				if (request.readyState == 4 && request.status != 200){
					cb();
				}
			}
			request.send();
        },
        login: function ($status, user_id, api_key, cb) {
            $status.removeClass('icon-ok icon-error').addClass('icon-throbber').text('logging in...');
			var request = new XMLHttpRequest();
			request.open("GET", root + 'login/api', true);
			request.setRequestHeader("X-API-USER", user_id);
			request.setRequestHeader("X-API-KEY", api_key);
			request.setRequestHeader("X-API-CLIENT", "opera");
			request.onreadystatechange = function () {
				if(request.readyState == 4){
					$status.removeClass('icon-throbber');
				}
				if(request.readyState == 4 && request.status == 200) {
					var d = JSON.parse(request.responseText);
					if (d.ok) {
                        cb(d.api_key);
                    } else {
                        $status.addClass('icon-error').text(d.error + ': ' + d.reason);
                    }
				}
				if (request.readyState == 4 && request.status != 200){
					$status.addClass('icon-error').text('error: ' + request.status + ', ' + request.statusText);
				}
			}
			request.send();
        },
        execute: function (user_id, api_key, test, cb) {
			var request = new XMLHttpRequest();
			request.open("POST", root + 'api/1/curl/execute', true);
			request.setRequestHeader('Content-Type', 'application/json');
			request.setRequestHeader("X-API-USER", user_id);
			request.setRequestHeader("X-API-KEY", api_key);
			request.setRequestHeader("X-API-CLIENT", "opera");
			request.setRequestHeader("Cache-Control", "no-cache");
			request.onreadystatechange = function () {
				if (request.readyState == 4 && request.status == 200) {
					var data = JSON.parse(request.responseText);
					cb(data);
				}
			}
			request.send(JSON.stringify(test));
        },
        status: function (user_id, api_key, job_id, cb) {
			var request = new XMLHttpRequest();
			request.open("GET", root + 'api/1/jobs/' + job_id + '/status', true);
			request.setRequestHeader("X-API-USER", user_id);
			request.setRequestHeader("X-API-KEY", api_key);
			request.setRequestHeader("X-API-CLIENT", "opera");
			request.setRequestHeader("Cache-Control", "no-cache");
			request.onreadystatechange = function () {
				if (request.readyState == 4 && request.status == 200) {
					var data = JSON.parse(request.responseText);
					cb(data);
				}
			}
			request.send();
        },
        abort: function (user_id, api_key, job_id) {
			var request = new XMLHttpRequest();
			request.open("PUT", root + 'api/1/jobs/' + job_id + '/abort', true);
			request.setRequestHeader("X-API-USER", user_id);
			request.setRequestHeader("X-API-KEY", api_key);
			request.setRequestHeader("X-API-CLIENT", "opera");
			request.setRequestHeader("Cache-Control", "no-cache");
			request.onreadystatechange = function () {
				if (request.readyState == 4 && request.status == 200) {
					// nothing here yet ?!
				}
			}
			request.send();
        }
    };
}());

$(function() {	
	var $message = $('#login #message');
	var $blitz = $('div#blitz');
	var $url = $blitz.find('#url');
	var $mode = $blitz.find('select#mode');
	var $region = $blitz.find('select#region');
	var $users = $blitz.find('select#users');
	var $duration = $blitz.find('select#duration');
	var $cookies = $blitz.find('div#cookies');
	var $run = $blitz.find('form#run');
	var $result = $blitz.find('div#result');
	var $results = $blitz.find('div#results');
	var $status = $blitz.find('div#status');
	
	var _url, _cookies = [];
	
	//Because Opera doesn't support access to page Cookies
	//We have to use the flowing methods
	//As soon as Opera add this ability to API this code will replace with better code
	
	//Strat Workaround 
	// _url = document.location.href;
	$url.text(window.localStorage.getItem('_url'));
	// raw_cookies = document.cookie.split(';');
	// for(i=0;i<raw_cookies.length;i++){
	// 	
	// }
	
	
	//End Workaround
	
	function showTab(name) {
        $('.tabs .tab').hide();
        $('.tabs .tab#' + name).show();
    }

    // Main API for running the tests (sprint or rush)
    var Test = (function () {
        var _timer, _job_in_q;

        function _reset() {
            $status.removeClass('icon-ok icon-error icon-throbber').empty();
            $result.css('opacity', '0.1');
        }

        function _finish() {
            clearTimeout(_timer);
            _timer = undefined;
            $run.animate({ opacity: 1 }, 'fast', function () {
                _job_in_q = undefined;
            });
        }

        function _error(e, test) {
            $status.removeClass('icon-throbber').addClass('icon-error');
            $status.text(e.error + ' error');
            if (e.error === 'authorize') {
                $results.html('See <a target="_blank" href="' + blitz.root() + '" class="extern">blitz.io</a> for more details.');
            }
            _finish();
        }

        function _ifNotError(test, job, cb) {
            if (job.status === 'queued') {
                return;
            } else if (job.status === 'aborted') {
                _error({ error: 'aborted', reason: 'Oops, something went wrong!' }, test);
                return;
            } else if (job.status === 'completed') {
                var error = job.result.error;
                if (error) {
                    _error(job.result, test);
                    return;
                }
            } else if (job.status === 'running') {
                if (!job.result) {
                    $status.text(test.pattern ? 'rushing' : 'sprinting');
                    return;
                }
            }

            cb();
        }

        function _prettyPrintDuration(duration) {
            if (duration < 1.0) {
                return Math.floor(duration * 1000) + ' ms';
            } else {
                return duration.toFixed(2) + ' sec';
            }
        }

        function _escape(t) {
            return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        function _renderSprint(test, job) {
            var duration = _prettyPrintDuration(job.result.duration);
            var status = job.result.response.status;
            var html = [];
            html.push('<span style="float:right"><span class="keyword">Details</span> @ <a target="_blank" href="' + blitz.root() + 'play/' + job._id + '" class="extern">blitz.io</a></span>');
            html.push('<strong>' + duration + '</strong> from ' + job.result.region + ' - ');
            if (status >= 200 && status < 300) {
                html.push('<span id="hits">' + status + '</span>');
            } else if (status < 200 || (status >= 300 && status < 500)) {
                html.push('<span id="timeouts">' + status + '</span>');
            } else {
                html.push('<span id="errors">' + status + '</span>');
            }
            html.push(_escape(' ' + job.result.response.message));
            $status.html(html.join(''));
            $status.removeClass('icon-throbber').addClass('icon-ok');
        }

        function _renderRush(user_id, api_key, test, job) {
            if (test.results === undefined) {
                var html = [];
                html.push('<div>');
                html.push('<div>');
                html.push('<a id="abort" class="button" href="#"><span>Abort</span></a>');
                html.push('<span id="progress" max="100">testing</span>');
                html.push('</div>');
                html.push('</div>');
                $results.html(html.join(''));
                test.$progress = $results.find('span#progress');
                test.$abort = $results.find('a#abort').click(function () {
                    blitz.abort(user_id, api_key, job._id);
                    $(this).remove();
                });
                test.results = [];
                test.$progress.attr('value', '0');
            }

            if (job.result && job.result.timeline) {
                var stats = job.result.timeline[job.result.timeline.length - 1];
                var text = '<span id="hits">' + stats.executed + '</span> hits';
                text += ' (<span id="hits">' + Math.floor(stats.executed / stats.timestamp) + '</span>/sec)';
                if (stats.timeouts) {
                    text += ', <span id="timeouts">' + stats.timeouts + '</span> timeouts';
                }
                if (stats.errors) {
                    text += ', <span id="errors">' + stats.errors + '</span> errors';
                }
                test.$progress.html(text);
                if (job.status === 'completed') {
                    test.$abort.remove();
                }
            }
        }

        function _render(user_id, api_key, test, job) {
            _ifNotError(test, job, function () {
                var last, duration, html = [];
                if (test.pattern) {
                    _renderRush(user_id, api_key, test, job);
                    last = job.result.timeline[job.result.timeline.length - 1];
                    if (last.duration > 0.0) {
                        duration = _prettyPrintDuration(last.duration);
                        html.push('<strong>' + duration + '</strong> from ' + job.result.region);
                    } else {
                        html.push('rushing from ' + job.result.region);                        
                    }

                    if (job.status === 'completed') {
                        html.unshift('<span style="float:right"><span class="keyword">Details</span> @ <a target="_blank" href="' + blitz.root() + 'play/' + job._id + '" class="extern">blitz.io</a></span>');
                        $status.removeClass('icon-throbber');
                        $status.addClass(last.timeouts || last.errors ? 'icon-error' : 'icon-ok');
                        _finish();
                    }
                    
                    $status.html(html.join(''));
                } else {
                    _renderSprint(test, job);
                    _finish();
                }
            });
        }

        function _check(user_id, api_key, test) {
            blitz.status(user_id, api_key, test.job_id, function (d) {
                _render(user_id, api_key, test, d);
                if (d.status === 'queued' || d.status === 'running') {
                    _timer = setTimeout(function () {
                        _check(user_id, api_key, test);
                    }, 2000);
                }
            });
        }

        function _start(user_id, api_key, test) {
            blitz.execute(user_id, api_key, test, function (d) {
                if (d.error) {
                    if (d.error === 'again') {
                        _error(d, test);
                        localStorage.clear();
                        showTab('login');
                    } else {
                        _error(d, test);
                    }
                } else {
                    $status.text('queued in ' + d.region);
                    test.job_id = d.job_id;
                    _timer = setTimeout(function () {
                        _check(user_id, api_key, test);
                    }, 2000);
                }
            });
        }

        return {
            start: function (user_id, api_key, test) {
                if (_timer || _job_in_q) {
                    return;
                }
                _job_in_q = true;
                _reset();
                $status.addClass('icon-throbber').text('processing');
                $run.animate({ opacity: 0.1 }, 'fast');
                $results.empty();
                $result.animate({ opacity: 1 }, 'slow', function () {
                    _start(user_id, api_key, test);
                });
            }
        };
    }());

    $run.submit(function () {
        var user_id = localStorage.getItem('user_id');
        var api_key = localStorage.getItem('api_key2');
        var test = { url: _url, region: $region.val(), timeout: 2000 };
        var mode = $mode.val();
        test.cookies = $.map(_cookies, function (cookie) {
            if ($cookies.find('input#cookie-' + cookie.name).is(':checked')) {
                return cookie.name + '=' + cookie.value;                
            }
        });
        if (mode === 'rush') {
            test.pattern = {
                intervals: [{
                    start: 1,
                    end: parseInt($users.val(), 10),
                    duration: parseInt($duration.val(), 10)
                }]
            };
        }
        Test.start(user_id, api_key, test);
        return false;
    });

    $('a#run').click(function () {
        $run.submit();
        return false;
    });

    $('a#advanced').click(function () {
        var $da = $('div#advanced');
        if ($da.css('display') === 'none') {
            $(this).prev('small').html('&#9660;');
        } else {
            $(this).prev('small').html('&#9658;');
        }
        $('div#advanced').toggle();
    });
    
    $mode.change(function () {
        var mode = $(this).val();
        localStorage.setItem('mode', mode);
        if (mode === 'rush') {
            $('span#rush').show();
        } else {
            $('span#rush').hide();
        }
    }).val(localStorage.getItem('mode') || 'sprint').change();

    $region.change(function () {
        localStorage.setItem('region', $(this).val());
    }).val(localStorage.getItem('region') || 'california').change();

    $users.change(function () {
        localStorage.setItem('users', $(this).val());
    }).val(localStorage.getItem('users') || '10').change();

    $duration.change(function () {
        localStorage.setItem('duration', $(this).val());
    }).val(localStorage.getItem('duration') || '10').change();

	
	if (localStorage.getItem('api_key2')) {
        showTab('blitz');
    } else {
        blitz.about(function (d) {
            showTab('login');
            if (d && d.profile) {
				localStorage.setItem('user_id', d.profile.email);
                blitz.login($message, d.profile.email, d.api_key, function (key2) {
                    localStorage.setItem('api_key2', key2);
                    showTab('blitz');
                });
            }
        });
    }
});