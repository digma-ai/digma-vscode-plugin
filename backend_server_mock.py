from flask import Flask, request, jsonify

storage = {
    'A.__init__':{ 'errors': 9 },
    'A.func':{ 'errors': 21 },
    'B.func':{ 'errors': 4 },
    'func1':{ 'errors': 15 },
    'func2':{ 'errors': 3 },
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