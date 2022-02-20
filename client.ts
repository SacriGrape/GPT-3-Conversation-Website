// import Express, obviously
import * as express from 'express'
import * as session from 'express-session'
import { Configuration, OpenAIApi } from "openai";
import { connect, Schema, model } from 'mongoose'

// Import stuff for tokenizer
import { encode } from 'gpt-3-encoder'
import { writeFileSync } from 'fs';

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

// Creating account data interface
interface AccountData {
    id: number
    conversations: string
    elements: String
}

// Creating the account schema
const AccountSchema = new Schema<Accounts>({
    id: { type: Number, required: true},
    username: { type: String, required: true },
    password: { type: String, required: true }
});

// Creat the AccountData Schema
const AccountDataSchema = new Schema<AccountData>({
    id: { type: Number, required: true},
    conversations: { type: String },
    elements: { type: String }
})

// Creating the account model
const AccountModel = model<Accounts>('Account', AccountSchema)

// Creating AccountData model
const AccountDataModel = model<AccountData>('AccountData', AccountDataSchema)

// use the JSON middleware which just lets you uhhhh... get JSON from POST requests I think?
app.use(express.json());

app.set('view engine', 'ejs');

app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

// create a new GET route for / that returns the HTML file
app.get('/', (req, res) => {
    if (req.session.isSignedIn) {
        AccountModel.exists({username: req.session.username}, (err, doc) => {
            if (err) {
                console.log(err)
            } else {
                var userData = null
                if (doc != null) {
                    AccountModel.findById(doc._id).then((user) => {
                        
                    })
                }

                var data = {
                    isSignedIn: req.session.isSignedIn,

                }
                res.render("index", data)
            }
        })
    }
});

app.get('/signup', (req, res) => {
    res.render("signup");
})

app.get('/login', (req, res) => {
    res.render("login")
})

app.post("/user/loadelementsfromaccount", (req, res) => {
    var savedElements = JSON.stringify({})
    if (req.session.isSignedIn) {
        AccountModel.findOne({username: req.session.username}).then((user) => {
            AccountDataModel.exists({id: user.id}, (err, doc) => {
                if (err) {
                    console.log(err)
                    res.send(JSON.stringify(savedElements))
                } else {
                    if (doc != null) {
                        AccountDataModel.findById(doc._id).then((data) => {
                            if (data.elements != null) {
                                savedElements = JSON.parse(data.elements.toString())
                                res.send(JSON.stringify(savedElements))
                            }
                        })
                    } else {
                        var accountData = new AccountDataModel({
                            id: user.id
                        })
                        accountData.save()
                        res.send(JSON.stringify(savedElements))
                    }
                }
            })
        })
    }
})

app.post("/user/saveelementstosession", (req, res) => {
    if (req.session.isSignedIn) {
        AccountModel.findOne({username: req.session.username}).then((user) => {
            AccountDataModel.exists({id: user.id}, (err, doc) => {
                if (err) {
                    console.log(err)
                } else {
                    if (doc != null) {
                        AccountDataModel.findById(doc._id).then((accountData) => {
                            accountData.elements = JSON.stringify(req.body)
                            accountData.save()
                        })
                    } else {
                        var accountData = new AccountDataModel({
                            id: user.id
                        })
                        accountData.elements = JSON.stringify(req.body)
                        accountData.save()
                    }
                }
            })
        })
    }
    res.send("")
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
                AccountModel.findById(doc._id).then((user) => {
                    data.isSignedIn = true
                    req.session.username = req.body.username
                    req.session.isSignedIn = true
                    req.session.id = user.id
                })
            } else {
                data.failReason = "Username or Password doesn't match!"
                res.send(JSON.stringify(data))
            }
        }
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
                req.session.id = id
            }
        }
        res.send(JSON.stringify(data))
    })
})

app.post('/api/generate_summary', (req, res) => {
    const configuration = new Configuration({
        apiKey: req.body.apiKey
    });

    req.body.question = req.body.questions.splice(req.body.question.length / 2)
    console.log(req.body.questions.length)

    var limit = questionLimit(req.body.questions, req.body.max_tokens)


    var questionString = ""
    for (var question of req.body.questions) {
        questionString += `${question.pl_name}: ${question.question}\n${question.ai_name}: ${question.response}\n\n`
    }

    var prompt = "Summarize the following conversation. Be concise, but include every detail learned from the conversation.\n\nConversation:\n\n" + questionString + "Summary:\n"
    console.log("Token Estimate: ", token_estimate(prompt, req.body.max_tokens))

    const openai = new OpenAIApi(configuration);
    openai.createCompletion(
        req.body.engine,
        {
            "prompt": prompt,
            "temperature": req.body.temperature,
            "max_tokens": req.body.max_tokens
        }
    ).then((r) => {
        var data = {
            prompt: prompt,
            response: r.data.choices[0].text.trim()
        }
        res.send(JSON.stringify(data))
    }).catch((err) => {
        res.send("I HIT AN ERROR!!!! (Likely token limit, reset the conversation to continue. If you wish to continue the conversation, copy the messages from the chat log and paste them into the charDesc and removing parts that you don't feel are needed)")
    })
})

app.post('/api/token_estimate', (req, res) => {
    var nextQuestion = req.body.nextQuestion
    
    if (nextQuestion.question == "") {
        nextQuestion = null
    }

    var tokenCount = token_estimate(promptGenerator(req.body.ai_charDesc, req.body.pl_charDesc, req.body.questions, nextQuestion, req.body.summary), req.body.max_tokens)
    res.send(tokenCount.toString())
})

app.post('/api/generate', (req, res) => {
    var prompt = promptGenerator(req.body.ai_charDesc, req.body.pl_charDesc, req.body.questions, req.body.nextQuestion, req.body.summary)
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
        var data = {
            response: r.data.choices[0].text,
            prompt: prompt
        }
        res.send(JSON.stringify(data))
    }).catch(err => {
        console.log(err)
        res.send("I HIT AN ERROR!!!! (Likely token limit, reset the conversation to continue. If you wish to continue the conversation, copy the messages from the chat log and paste them into the charDesc and removing parts that you don't feel are needed)")
    })
});

// start the server
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});

function token_estimate(string: String, max_tokens: number) {
    return(encode(string).length + max_tokens)
}

function questionLimit(questions: any[], max_tokens: number) {
    var questionString = ""
    var i = 0
    for (var question of questions) {
        questionString += `${question.pl_name}: ${question.question}\n${question.ai_name}: ${question.response}\n\n`
        if ((token_estimate(questionString, max_tokens)) > 2048) {
            break;
        }
        i++
    }
    console.log(token_estimate(questionString, max_tokens) + max_tokens)
    return i
}

function promptGenerator(ai_charDesc: string, pl_charDesc: string, questions: any, nextQuestion: any, summary: any) {
    var prompt = ""
    if (ai_charDesc != "") {
        prompt += nextQuestion.ai_name + "'s description: " + ai_charDesc + "\n\n"
    }

    if (pl_charDesc != "") {
        prompt += nextQuestion.pl_name + "'s description: " + pl_charDesc + "\n\n"
    }

    if (summary != "") {
        prompt += summary + "\n\n"
    }
    
    for (var question of questions) {
        prompt += `${question.pl_name}: ${question.question}\n${question.ai_name}: ${question.response}\n\n`
    }

    if (nextQuestion != null) {
        prompt += `${nextQuestion.pl_name}: ${nextQuestion.question}\n${nextQuestion.ai_name}:`
    }

    return prompt
}