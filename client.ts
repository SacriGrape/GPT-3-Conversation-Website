// import Express, obviously
import * as express from 'express'
import * as session from 'express-session'
import { Configuration, OpenAIApi } from "openai";
import { connect, Schema, model } from 'mongoose'

// Import stuff for tokenizer
import { encode } from 'gpt-3-encoder'
import { request } from 'http';

// create a new Express app, idk they included the port in a const here in the example but you don't have to obviously
const app = express();
const port = 3000;

// Setting up Database stuff
// Connecting to Database
connect('mongodb://127.0.0.1:27017/gpt3-site-db');

// Creating account interface
interface Accounts {
    id: number
    username: string;
    password: string;
    email: string
}

// Creating the account schema
const AccountSchema = new Schema<Accounts>({
    id: { type: Number, required: true},
    username: { type: String, required: true },
    password: { type: String, required: true }
});

// Creating the account model
const AccountModel = model<Accounts>('Account', AccountSchema)

// use the JSON middleware which just lets you uhhhh... get JSON from POST requests I think?
app.use(express.json());

app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

// create a new GET route for / that returns the HTML file
app.get('/', (req, res) => {
    res.sendFile('./index.html', { root: __dirname });
});

app.get('/signup', (req, res) => {
    res.sendFile('./signup.html', {root: __dirname });
})

app.get('/login', (req, res) => {
    res.sendFile('./login.html', {root: __dirname });
})

app.post('/user/login', (req, res) => {
    AccountModel.exists({username: req.body.username, password: req.body.password}, (err, doc) => {
        var data = {
            isSignedIn: false,
            failReason: null
        }

        if (err) {
            console.log(err)
            data.failReason = null
        } else {
            if (doc != null) {
                data.isSignedIn = true
                req.session.username = req.body.username
                req.session.isSignedIn = true
            } else {
                data.failReason = "Username or Password doesn't match!"
            }
        }
        console.log(data)
        res.send(JSON.stringify(data))
    })
})

app.post('/user/signout', (req, res) => {
    req.session.isSignedIn = false
    req.session.username = null
    res.send("")
})

app.post('/user/signedin', (req, res) => {
    if (req.session.isSignedIn != true) {
        req.session.isSignedIn = false
    }
    var data = {
        username: req.session.username,
        isSignedIn: req.session.isSignedIn
    }
    res.send(JSON.stringify(data))
})

app.post('/user/createaccount', (req, res) => {
    AccountModel.exists({username: req.body.username}, (err, doc) => {
        var data = {
            accountCreated: false,
            failReason: null
        }
        if (err) {
            console.log(err)
            data.failReason = "Error was thrown, try again in a bit!"
        } else {
            if (doc != null) {
                data.failReason = "Username taken!"
            } else {
                data.accountCreated = true
                var id = Math.floor((new Date()).getTime() / 1000)
                var newAccount = new AccountModel({
                    id: id,
                    username: req.body.username,
                    password: req.body.password
                })
                newAccount.save()

                req.session.isSignedIn = true
                req.session.username = req.body.username
            }
        }
        res.send(JSON.stringify(data))
    })
})

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