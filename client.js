"use strict";
exports.__esModule = true;
// import Express, obviously
var express = require('express');
var openai_1 = require("openai");
// Import stuff for tokenizer
var gpt_3_encoder_1 = require("gpt-3-encoder");
var fs_1 = require("fs");
// create a new Express app, idk they included the port in a const here in the example but you don't have to obviously
var app = express();
var port = 3000;
// use the JSON middleware which just lets you uhhhh... get JSON from POST requests I think?
app.use(express.json());
// create a new GET route for / that returns the HTML file
app.get('/', function (req, res) {
    res.sendFile('./index.html', { root: __dirname });
});
app.post('/api/token_estimate', function (req, res) {
    var nextQuestion = req.body.nextQuestion;
    if (nextQuestion.question == "") {
        nextQuestion = null;
    }
    var tokenCount = gpt_3_encoder_1.encode(promptGenerator(req.body.ai_charDesc, req.body.pl_charDesc, req.body.questions, nextQuestion)).length;
    res.send(tokenCount.toString());
});
app.post('/api/generate', function (req, res) {
    var prompt = promptGenerator(req.body.ai_charDesc, req.body.pl_charDesc, req.body.questions, req.body.nextQuestion);
    fs_1.writeFileSync("./ai_prompt.txt", prompt);
    var configuration = new openai_1.Configuration({
        apiKey: req.body.apiKey
    });
    var openai = new openai_1.OpenAIApi(configuration);
    openai.createCompletion(req.body.engine, {
        "prompt": prompt,
        "temperature": req.body.temperature,
        "max_tokens": req.body.max_tokens
    }).then(function (r) {
        res.send(r.data.choices[0].text);
    })["catch"](function (err) {
        console.log(err);
        res.send("I HIT AN ERROR!!!! (Likely token limit, reset the conversation to continue. If you wish to continue the conversation, copy the messages from the chat log and paste them into the charDesc and removing parts that you don't feel are needed)");
    });
});
// start the server
app.listen(port, function () {
    console.log("Listening on port " + port);
});
function promptGenerator(ai_charDesc, pl_charDesc, questions, nextQuestion) {
    var prompt = "";
    if (ai_charDesc != "") {
        prompt += nextQuestion.ai_name + "'s description: " + ai_charDesc + "\n\n";
    }
    if (pl_charDesc != "") {
        prompt += nextQuestion.pl_name + "'s description: " + pl_charDesc + "\n\n";
    }
    for (var _i = 0, questions_1 = questions; _i < questions_1.length; _i++) {
        var question = questions_1[_i];
        prompt += question.pl_name + ": " + question.question + "\n" + question.ai_name + ": " + question.response + "\n\n";
    }
    if (nextQuestion != null) {
        prompt += nextQuestion.pl_name + ": " + nextQuestion.question + "\n" + nextQuestion.ai_name + ":\n\n";
    }
    return prompt;
}
