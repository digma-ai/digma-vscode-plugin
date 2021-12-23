from flask import Flask, request, jsonify

storage = {
    'A.__init__':{ 
        'trend': 'up',
        'errorFlows':[
            {
                'trend': 'up',
                'frequency': '20 per day',
                'impact': 'high',
                'displayName': 'NullError',
                'stackTrace': 'stack1',
            },
            {
                'trend': 'down',
                'frequency': '3 per day',
                'impact': 'low',
                'displayName': 'InvalidArgumentException',
                'stackTrace': 'stack2',
            } ,
            {
                'trend': 'up',
                'frequency': '7 per day',
                'impact': 'high',
                'displayName': 'TimeoutException',
                'stackTrace': '''
Traceback (most recent call last):
  File “”/Users/shaykeren/work/example-fastapi-app/venv3/lib/python3.8/site-packages/opentelemetry/trace/__init__.py”“, line 541, in use_span
    yield span
  File “”/Users/shaykeren/work/example-fastapi-app/venv3/lib/python3.8/site-packages/opentelemetry/sdk/trace/__init__.py”“, line 988, in start_as_current_span
    yield span_context
  File “”/Users/shaykeren/work/example-fastapi-app/venv3/lib/python3.8/site-packages/opentelemetry/instrumentation/asgi/__init__.py”“, line 346, in __call__
    await self.app(scope, wrapped_receive, wrapped_send)
  File “”/Users/shaykeren/work/example-fastapi-app/venv3/lib/python3.8/site-packages/starlette/exceptions.py”“, line 82, in __call__
    raise exc
  File “”/Users/shaykeren/work/example-fastapi-app/venv3/lib/python3.8/site-packages/starlette/exceptions.py”“, line 71, in __call__
    await self.app(scope, receive, sender)
  File “”/Users/shaykeren/work/example-fastapi-app/venv3/lib/python3.8/site-packages/starlette/routing.py”“, line 656, in __call__
    await route.handle(scope, receive, send)
  File “”/Users/shaykeren/work/example-fastapi-app/venv3/lib/python3.8/site-packages/starlette/routing.py”“, line 259, in handle
    await self.app(scope, receive, send)
  File “”/Users/shaykeren/work/example-fastapi-app/venv3/lib/python3.8/site-packages/starlette/routing.py”“, line 61, in app
    response = await func(request)
  File “”/Users/shaykeren/work/example-fastapi-app/venv3/lib/python3.8/site-packages/fastapi/routing.py”“, line 226, in app
    raw_response = await run_endpoint_function(
  File “”/Users/shaykeren/work/example-fastapi-app/venv3/lib/python3.8/site-packages/fastapi/routing.py”“, line 159, in run_endpoint_function
    return await dependant.call(**values)
  File “”/Users/shaykeren/work/example-fastapi-app/main.py”“, line 35, in root
    user_service.all()
  File “”/Users/shaykeren/work/example-fastapi-app/user_service.py”“, line 9, in all
    return self.user_store.get_users()
  File “”/Users/shaykeren/work/example-fastapi-app/user_store.py”“, line 3, in get_users
    raise ValueError(‘invalid value’)
ValueError: invalid value''',
            } 
        ]
    },
    'A.func':{ 'trend': 'up', 'errorFlows': [{}] },
    'B.func':{ 'trend': 'down', 'errorFlows': [] },
    'func1':{ 'trend': 'up', 'errorFlows': [] },
    'func2':{ 'trend': 'down', 'errorFlows': [] },
}

app = Flask(__name__)

@app.route("/analytics/get_by_ids", methods = ['POST'])
def hello_world():
    ids = request.json['ids']
    result = {
        'analytics': {k:v for k,v in storage.items() if k in ids}
    }
    return jsonify(result)

if __name__ == '__main__':
    app.run()