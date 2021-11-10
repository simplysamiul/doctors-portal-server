const express =  require("express");
const app = express();
const cors = require("cors");
const { MongoClient } = require('mongodb');
const admin = require("firebase-admin");
const port = process.env.PORT || 5000;
require('dotenv').config();


// Middleware 
app.use(cors());
app.use(express.json());


var serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// Connect with db
const uri = `1mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2pwml.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req,res,next){
    if(req.headers?.authorization?.startsWith("Bearer ")){
        const token = req.headers.authorization.split(' ')[1];

        try{
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch{

        }
    }
        next();
}

async function run(){
    try{
        await client.connect();

        const database = client.db("doctors_portal");
        const appoinmentCollection = database.collection("appoinments");
        const userCollection = database.collection("users");
        // Get Api
        app.get('/appoinments', verifyToken,  async(req,res)=>{
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();
            const query = {email : email, date : date};
            const cursor = appoinmentCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        // Api Post
        app.post("/appoinments", async(req,res) =>{
            const appoinment = req.body;
            const result = await appoinmentCollection.insertOne(appoinment);
            res.json(result); 
        });
        // User api get
        app.get("/users/:email", async(req, res)=>{
            const email = req.params.email;
            const query = {email};
            const user = await userCollection.findOne(query);
            let isAdmin = false;
            if(user?.role === "admin"){
                isAdmin = true;
            }
            res.json({admin : isAdmin});
        })

        // Api post in user collection database
        app.post("/users", async(req,res)=>{
            const user = req.body;
            console.log(user);
            const result  = await userCollection.insertOne(user);
            res.json(result);
        });
        // Update data in user collection 
        app.put("/users", async(req,res)=>{
            const user = req.body;
            const filter = {email : user.email}; 
            const options = { upsert: true };
            const updateDoc = {$set :  user};
            const result  = await userCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });
        // update admin
       app.put("/users/admin", verifyToken, async(req,res)=>{
            const user = req.body;
            const requester = req.decodedEmail;
            if(requester){
                const requesterAccount = await userCollection.findOne({email: requester});
                if(requesterAccount.role === "admin"){
                    const filter = {email : user.email};
                    const updateDoc = {$set  : {role: "admin"}};
                    const result  = await userCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else{
                res.status(403).json({message : "You don't have access make admin"});
            }
       });
    }
    finally{
        // await client.close();
    }
}
run().catch(console.dir);

// Root Router
app.get('/', (req,res)=>{
    res.send("Doctors portal server stareed !")
});

app.listen(port, (req,res)=>{
    console.log(`Port listing at ${port}`)
});