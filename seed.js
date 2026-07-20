require('dotenv').config()
const mongoose = require('mongoose')
const Course   = require('./models/Course.model')
const Service  = require('./models/Service.model')
const HeroSlide = require('./models/HeroSlide.model')

const defaultCourses = [
  { title:'Web Development', subtitle:'Full Stack Course', description:'Learn HTML, CSS, JS, React, Node.js from scratch to advanced.', icon:'💻', tag:'Development', bgFrom:'#03045e', bgTo:'#0077b6', accent:'#48cae4', duration:'6 Months', level:'Beginner', price:0, seats:30, features:['HTML/CSS/JS','React.js','Node.js','MongoDB','Projects'], order:1 },
  { title:'Digital Marketing', subtitle:'Marketing Mastery', description:'Master SEO, social media, email marketing and paid ads.', icon:'📈', tag:'Marketing', bgFrom:'#023e8a', bgTo:'#0096c7', accent:'#90e0ef', duration:'3 Months', level:'Beginner', price:0, seats:25, features:['SEO','Social Media','Email Marketing','Google Ads','Analytics'], order:2 },
  { title:'UI/UX Design', subtitle:'Design Fundamentals', description:'Learn Figma, user research, wireframing and prototyping.', icon:'🎨', tag:'Design', bgFrom:'#0077b6', bgTo:'#48cae4', accent:'#caf0f8', duration:'4 Months', level:'Intermediate', price:0, seats:20, features:['Figma','User Research','Wireframing','Prototyping','Design Systems'], order:3 },
  { title:'Data Science', subtitle:'AI & Machine Learning', description:'Python, data analysis, ML algorithms and AI fundamentals.', icon:'🤖', tag:'AI/ML', bgFrom:'#0096c7', bgTo:'#ade8f4', accent:'#023e8a', duration:'6 Months', level:'Advanced', price:0, seats:20, features:['Python','Data Analysis','Machine Learning','Deep Learning','Projects'], order:4 },
]

const defaultServices = [
  { title:'Fee Concession',       description:'Apply for fee relief or installment plans based on financial need.', icon:'💰', tag:'Financial Aid', bgFrom:'#03045e', bgTo:'#0077b6', accent:'#48cae4', order:1 },
  { title:'Scholarship',          description:'Merit & need-based scholarships — apply online.',                   icon:'🎓', tag:'Scholarship',   bgFrom:'#023e8a', bgTo:'#0096c7', accent:'#90e0ef', order:2 },
  { title:'Character Certificate',description:'Request an official character certificate in 24 hours.',           icon:'📜', tag:'Documents',     bgFrom:'#0077b6', bgTo:'#48cae4', accent:'#caf0f8', order:3 },
  { title:'Hostel Allocation',     description:'Apply for hostel room or transfer request online.',                icon:'🏠', tag:'Campus Life',   bgFrom:'#0096c7', bgTo:'#ade8f4', accent:'#023e8a', order:4 },
  { title:'Transcript Request',   description:'Official transcripts for jobs or further education.',              icon:'📋', tag:'Academic',      bgFrom:'#03045e', bgTo:'#0096c7', accent:'#48cae4', order:5 },
  { title:'Complaint/Grievance',  description:'Submit formal complaints to administration.',                      icon:'⚠️', tag:'Support',       bgFrom:'#023e8a', bgTo:'#0077b6', accent:'#90e0ef', order:6 },
]

const defaultSlides = [
  { imageUrl:'/gallery/Ai.png',  text:'Learn. Apply. Grow.',           isActive:true, order:1 },
  { imageUrl:'/gallery/Ai2.png', text:'Track Your Progress.',           isActive:true, order:2 },
  { imageUrl:'/gallery/Ai3.png', text:'Achieve Your Goals.',            isActive:true, order:3 },
  { imageUrl:'/gallery/Ai4.png', text:'Join Thousands of Students.',    isActive:true, order:4 },
]

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('MongoDB connected')

    const courseCount = await Course.countDocuments()
    if (courseCount === 0) {
      await Course.insertMany(defaultCourses)
      console.log('✅ Default courses seeded')
    } else {
      console.log('Courses already exist, skipping')
    }

    const serviceCount = await Service.countDocuments()
    if (serviceCount === 0) {
      await Service.insertMany(defaultServices)
      console.log('✅ Default services seeded')
    } else {
      console.log('Services already exist, skipping')
    }

    const slideCount = await HeroSlide.countDocuments()
    if (slideCount === 0) {
      await HeroSlide.insertMany(defaultSlides)
      console.log('✅ Default hero slides seeded')
    } else {
      console.log('Hero slides already exist, skipping')
    }

    console.log('Seed complete!')
    process.exit(0)
  } catch (err) {
    console.error('Seed error:', err)
    process.exit(1)
  }
}

seed()
