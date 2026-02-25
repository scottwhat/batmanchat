

//connect to the db, return a function for db connections 

// use mongoose for the db 
import mongoose from 'mongoose'

export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI)
        console.log(`Mongodb connected: ${conn.connection.host}`)
        
    } catch (error) {
        console.error('Error', error)
        process.exit(1)
    }
}