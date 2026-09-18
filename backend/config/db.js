const mongoose =require('mongoose');
module.exports.connectToMondoDB=async()=> {

    await mongoose.connect( process.env.url_MongoDB ).then(() => { 
console.log('connected to MongoDB');
}).catch((err) => { 
console.error('Error connecting to  MongoDB: ' , err);
});

}