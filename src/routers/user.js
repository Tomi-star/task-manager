const express = require('express')
const router = new express.Router()
const User= require('../models/user')
const auth = require('../middleware/auth');
const multer = require('multer');
const sharp = require('sharp');
const { sendWelcomeEmail, CancelMail} =require('../emails/account')


router.get('/users/me', auth, async (req, res) => {
    res.send(req.user)
})

router.post('/users/login', async(req,res) =>{
    try{
        const user = await User.findByCredentials(req.body.email, req.body.password)
        const token = await user.generateAuthToken()
        res.send({user, token})
    } catch (e) {
        res.status(400).send()
    }
})

router.post('/users/logout', auth, async (req,res) =>{
    try{
        req.user.tokens = req.user.tokens.filter( token =>{
            return token.token !== req.token
        })

        await req.user.save()

        res.send()
    } catch (e) {
        res.status(500).send()
    }
})

router.post('/user/logoutAll', auth, async (req, res) =>{
    try{
        req.user.tokens = req.user.tokens.filter(token => token.token == req.token)

        await req.user.save();
        res.send()
    } catch (e) {
        res.status(500).send()
    }
})

router.post('/users', async (req, res) => {
    const user = new User(req.body)
    try {
        await user.save()
        sendWelcomeEmail(user.email, user.name)
        const token = await user.generateAuthToken()

        res.status(201).send({user, token})
    } catch (e) {
        res.status(400).send(e)
    }
})

router.patch('/users/me', auth, async (req, res) => {
    const updates = Object.keys(req.body)
    const allowedUpdates = ['name', 'email', 'age', 'password']
    const isValidOperation = updates.every(update => allowedUpdates.includes(update))

    if (!isValidOperation) {
        return res.status(400).send({ error: 'Invalid Updates' })
    }
    try {
        updates.forEach((update) => req.user[update] = req.body[update])
        await req.user.save()

        res.status(200).send(req.user)
        
    } catch (e) {
        res.status(400).send(e)
    }
})

router.delete('/users/me', auth,  async (req, res) => {
    try { 
        await req.user.remove()
        res.send(req.user)

        CancelMail(req.user.email, req.user.name)
    } catch (e) {
        res.status(500).send()
    }
})


const upload = multer({
    limits:{
        fileSize: 1000000
    },
    fileFilter(req,file,cb){
        if(!file.originalname.match(/\.(jpg|jpeg|png|JPG)$/)){
            return cb(new Error('File must be an image'))
        }
        cb(undefined, true)

    }
})

router.post('/users/me/avatar', auth, upload.single('avatars'), async (req, res) =>{
    const buffer = await sharp(req.file.buffer).resize({width:250, height:250}).png().toBuffer()
    req.user.avatar = buffer

    await req.user.save();
    res.send()
}, (error, req, res, next) =>{
    res.status(404).send({error: error.message})
});

router.delete('/users/me/avatar', auth, async(req,res) =>{
    if(req.user.avatar === undefined){
        return res.status(404).send({error: 'You do not have a profile picture'})
    }
    req.user.avatar = undefined
    await req.user.save()
    console.log(req)

    res.send()
})

// Set this up as a link
router.get('/users/:id/avatar', async (req,res) =>{
    try{
        const user = await User.findById(req.params.id)

        if(!user || !user.avatar){
            throw new Error()
        }
        res.set('Content-Type','image/.png')
        res.send(user.avatar);
    } catch (e) {
        res.status(404).send()
    }
})

module.exports = router