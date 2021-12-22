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
                'stackTrace': 'stack3',
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