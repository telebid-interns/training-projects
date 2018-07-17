from flask import Flask, render_template
from flask_restful import Resource, Api

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html',
                           fast_tasks=[{'name': 'labyrinth', 'url': "/interactive/labyrinth"}])


@app.route('/interactive/:task_name:')
def interactive(task_name):
    return render_template(task_name + '.html')
