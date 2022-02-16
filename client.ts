// import Express, obviously
const express = require('express');
import { Configuration, OpenAIApi } from "openai";

// Import stuff for tokenizer
import { encode } from 'gpt-3-encoder'
import { writeFileSync } from "fs";

// create a new Express app, idk they included the port in a const here in the example but you don't have to obviously
const app = express();
const port = 3000;

// use the JSON middleware which just lets you uhhhh... get JSON from POST requests I think?
app.use(express.json());

// create a new GET route for / that returns the HTML file
app.get('/', (req, res) => {
    res.sendFile('./index.html', { root: __dirname });
});

app.post('/api/token_estimate', (req, res) => {
    var nextQuestion = req.body.nextQuestion
    
    if (nextQuestion.question == "") {
        nextQuestion = null
    }

    var tokenCount = encode(promptGenerator(req.body.ai_charDesc, req.body.pl_charDesc, req.body.questions, nextQuestion)).length
    res.send(tokenCount.toString())
})

app.post('/api/generate', (req, res) => {
    var prompt = promptGenerator(req.body.ai_charDesc, req.body.pl_charDesc, req.body.questions, req.body.nextQuestion)
    writeFileSync("./ai_prompt.txt", prompt)
    const configuration = new Configuration({
        apiKey: req.body.apiKey
    });

    const openai = new OpenAIApi(configuration);
    openai.createCompletion(
        req.body.engine,
        {
            "prompt": prompt,
            "temperature": req.body.temperature,
            "max_tokens": req.body.max_tokens
        }
    ).then(r => {
        res.send(r.data.choices[0].text)
    }).catch(err => {
        console.log(err)
        res.send("I HIT AN ERROR!!!! (Likely token limit, reset the conversation to continue. If you wish to continue the conversation, copy the messages from the chat log and paste them into the charDesc and removing parts that you don't feel are needed)")
    })
});

// start the server
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});

function promptGenerator(ai_charDesc: string, pl_charDesc: string, questions: any, nextQuestion: any) {
    var prompt = ""
    if (ai_charDesc != "") {
        prompt += nextQuestion.ai_name + "'s description: " + ai_charDesc + "\n\n"
    }

    if (pl_charDesc != "") {
        prompt += nextQuestion.pl_name + "'s description: " + pl_charDesc + "\n\n"
    }
    
    for (var question of questions) {
        prompt += `${question.pl_name}: ${question.question}\n${question.ai_name}: ${question.response}\n\n`
    }

    if (nextQuestion != null) {
        prompt += `${nextQuestion.pl_name}: ${nextQuestion.question}\n${nextQuestion.ai_name}:\n\n`
    }

    return prompt
}