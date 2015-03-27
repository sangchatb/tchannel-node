// Copyright (c) 2015 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

'use strict';

var parallel = require('run-parallel');
var Buffer = require('buffer').Buffer;
var extend = require('xtend');
var allocCluster = require('./lib/alloc-cluster.js');
var EndpointHandler = require('../endpoint-handler');

var Cases = [

    {
        name: 'bufferOp',
        op: Buffer('foo'),
        reqHead: null,
        reqBody: null,
        resHead: '',
        resBody: ''
    },

    {
        name: 'stringOp',
        op: 'foo',
        reqHead: null,
        reqBody: null,
        resHead: '',
        resBody: ''
    },

    {
        name: 'bufferHead',
        op: 'foo',
        reqHead: Buffer('abc'),
        reqBody: null,
        resHead: 'abc',
        resBody: ''
    },

    {
        name: 'stringHead',
        op: 'foo',
        reqHead: 'abc',
        reqBody: null,
        resHead: 'abc',
        resBody: ''
    },

    {
        name: 'objectHead',
        op: 'foo',
        reqHead: JSON.stringify({value: 'abc'}),
        reqBody: null,
        resHead: '{"value":"abc"}',
        resBody: ''
    },

    {
        name: 'nullHead',
        op: 'foo',
        reqHead: null,
        reqBody: null,
        resHead: '',
        resBody: ''
    },

    {
        name: 'undefinedHead',
        op: 'foo',
        reqHead: undefined,
        reqBody: null,
        resHead: '',
        resBody: ''
    },

    {
        name: 'bufferBody',
        op: 'foo',
        reqHead: null,
        reqBody: Buffer('abc'),
        resHead: '',
        resBody: 'abc'
    },

    {
        name: 'stringBody',
        op: 'foo',
        reqHead: null,
        reqBody: 'abc',
        resHead: '',
        resBody: 'abc'
    },

    {
        name: 'objectBody',
        op: 'foo',
        reqHead: null,
        reqBody: JSON.stringify({value: 'abc'}),
        resHead: '',
        resBody: '{"value":"abc"}'
    },

    {
        name: 'nullBody',
        op: 'foo',
        reqHead: null,
        reqBody: null,
        resHead: '',
        resBody: ''
    },

    {
        name: 'undefinedBody',
        op: 'foo',
        reqHead: null,
        reqBody: undefined,
        resHead: '',
        resBody: ''
    },

];

allocCluster.test('request().send() to a server', 2, function t(cluster, assert) {
    var one = cluster.channels[0];
    var two = cluster.channels[1];
    var hostOne = cluster.hosts[0];

    one.handler = EndpointHandler();

    one.handler.register('foo', function foo(req, res, arg2, arg3) {
        assert.ok(Buffer.isBuffer(arg2), 'handler got an arg2 buffer');
        assert.ok(Buffer.isBuffer(arg3), 'handler got an arg3 buffer');
        res.sendOk(arg2, arg3);
    });

    parallel(Cases.map(function eachTestCase(testCase) {
        testCase = extend({
            channel: two,
            opts: {host: hostOne},
        }, testCase);
        return sendTest(testCase, assert);
    }), function onResults(err) {
        assert.ifError(err, 'no errors from sending');
        cluster.assertCleanState(assert, {
            channels: [{
                peers: [{
                    connections: [
                        {direction: 'in', inOps: 0, outOps: 0}
                    ]
                }]
            }, {
                peers: [{
                    connections: [
                        {direction: 'out', inOps: 0, outOps: 0}
                    ]
                }]
            }]
        });
        assert.end();
    });
});

function sendTest(testCase, assert) {
    return function runSendTest(callback) {
        testCase.channel
            .request(testCase.opts)
            .send(testCase.op, testCase.reqHead, testCase.reqBody, onResult);
        function onResult(err, res, arg2, arg3) {
            var head = arg2;
            var body = arg3;
            assert.ifError(err, testCase.name + ': no result error');
            if (!err) {
                assert.ok(Buffer.isBuffer(head), testCase.name + ': got head buffer');
                assert.ok(Buffer.isBuffer(body), testCase.name + ': got body buffer');
                assert.equal(head ? String(head) : head, testCase.resHead, testCase.name + ': expected head content');
                assert.equal(body ? String(body) : body, testCase.resBody, testCase.name + ': expected body content');
            }
            callback();
        }
    };
}
