//this is our api.js
const express = require('express');
const app = express();
const courseRoute = express.Router();

// models
let Course = require('../model/Course');
let User = require('../model/User');
let Membership = require('../model/Membership');
let Schedule = require('../model/Schedule');

//import logging tool
let Log = require('../logging')


// Add Course with schedule and membership type---------------------------------------------------------------------
courseRoute.route('/add-course').post((req, res, next) => {
  var newCourse = req.body.course;
  var sessionMembership = req.body.session;
  var subscriptionMembership = req.body.subscription;
  var schedules = req.body.schedule;

  Course.create(newCourse, (error, data) => {
    if (error)  return next(error);

    // add id of session and membership type if added
    if (sessionMembership!=null) {
      sessionMembership.course = data._id;
      sessionMembership.membership_type = 'session';

      Membership.create(sessionMembership, (error, sessionData) => {
        if (error)  return next(error);

        //find Course id and set session membership ID
        Course.findByIdAndUpdate(data._id, {
          $set: {"session_membership": sessionData._id}
        }, (error, data) => {
          if (error)  return next(error);
        })
      })
    }

    //create a subscription membership if added
    if (subscriptionMembership!=null) {
      subscriptionMembership.course = data._id;
      subscriptionMembership.membership_type = 'subscription';

        Membership.create(subscriptionMembership, (error, subscriptionData) => {
          if (error)  return next(error);

          //find Course id and set subscription membership ID
          Course.findByIdAndUpdate(data._id, {
            $set: {"subscription_membership": subscriptionData._id}
          }, (error, data) => {
            if (error)  return next(error);
          })
        })
    }

    //iterating through schedule array to create the schedule
    for(schedule of schedules){
      schedule.course = data._id;

      Schedule.create(schedule, (error, scheduleData) => {
        if (error)  return next(error);

        //find Course id and set subscription membership ID
        Course.findByIdAndUpdate(data._id, {
          $push: {"schedule": scheduleData._id}
        }, (error, data, next) => {
          if (error)
            return next(error);
            console.log(error)
        })
      })
    }

    //log event
    Log.newLog("New course created by admin. Course id:" + data._id)
    res.json(data);
  })

});


// Get all course------------------------------------------------------------------------------------------
courseRoute.route('/').get((req, res) => {
  Course.find((error, data) => {
    if (error) {
      return next(error)
    } else {
      res.json(data)
    }
  })
})

// Get single course------------------------------------------------------------------------------------------------
courseRoute.route('/read-course/:id').get((req, res) => {
  Course.findById(req.params.id, (error, data) => {
    if (error) {
      return next(error)
    } else {
      res.json(data)
    }
  })
})

// Get members of course-------------------------------------------------------------------------------------------
courseRoute.route('/course-members/:id').get((req, res) => {
  Course.findById(req.params.id).populate('members.member').exec((error, data) => {
    if (error) {
      return next(error)
    } else {
      res.json(data.members)
    }
  })
})

// Get all members not enrolled to a specific course---------------------------------------------------------------------
courseRoute.route('/members-not-enrolled-in-course/:id').get((req, res) => {
  User.find({ "courses.course": {$ne:req.params.id}, "role":"member" } ,(error, data) => {
    if (error) {
      return next(error)
    } else {
      res.json(data)
    }
  })
})

// Get instructors of course-------------------------------------------------------------------------------------------
courseRoute.route('/course-instructors/:id').get((req, res) => {
  Course.findById(req.params.id).populate('instructors').exec((error, data) => {
    if (error) {
      return next(error)
    } else {
      res.json(data.instructors)
    }
  })
})

//update course----------------------------------------------------------------------------------------------------
courseRoute.route('/update/:id').put((req, res, next) => {
  console.log(req.body);

  Course.findByIdAndUpdate(req.params.id, {
    $set: req.body
  }, (error, data) => {
    if (error) {
      return next(error);
      console.log(error)
    } else {
      console.log('Course successfully updated!')
      //Log event
      Log.newLog("Course updated! Course id:" + req.params.id)
      res.json(data)
    }
  })
})


// register member to a course - used by both admin and instructor--------------------------------------------------------
courseRoute.route('/register-user-to-course/:id').put((req, res, next) => {

  var userMembership = new Object();
  userMembership.member = req.body.member_id;
  userMembership.membership = req.body.membership_id;
  var courseMembership = new Object();
  courseMembership.course = req.params.id;
  courseMembership.membership = req.body.membership_id;

  //find course and push user with membership
  Course.findByIdAndUpdate(req.params.id, {
    $push: {"members": userMembership}
  }, (error, data) => {
    if (error) {
      return next(error);
      console.log(error)
    } else {

      //find membership
      Membership.findById(req.body.membership_id, (error, memData) => {
        if (error) { return next(error) }

        //check if membership is session type to add number of sessions
        if (memData.membership_type == "session"){
          courseMembership.sessions_remaining = memData.number_of_sessions;
        }

        //find user and push course, membership and number of sessions if applicable
        User.findByIdAndUpdate(req.body.member_id, {
          $push: {"courses": courseMembership}
        }, (error, data) => {
          if (error) {
            return next(error);
            console.log(error)
          } else {
            console.log('Course added to member!')
          }
        })
      })

      console.log('Member successfully enrolled!')
      //log event
      Log.newLog("Member enrolled to a course. Member ID:"+req.body.member_id+" Course ID:"+req.params.id)
      res.json(data)
    }
  })

})

// remove member from a course - used by both admin and instructor--------------------------------------------
courseRoute.route('/remove-user-from-course/:id').put((req, res, next) => {

  //find course and remove member from the array
  Course.findByIdAndUpdate(req.params.id, {
    $pull: {"members": {"member": req.body.member_id}}
  }, (error, data) => {
    if (error) {
      console.log(error);
      return next(error);
    } else {

      //find user and remove course from the array
      User.findByIdAndUpdate(req.body.member_id, {
        $pull: {"courses": {"course": req.params.id}}
      }, (error, data) => {
        if (error) {
          console.log(error);
          return next(error);
        } else {

        }
      })

      console.log('Member successfully removed from the course!')
      //log event
      Log.newLog("Member removed from a course. Member ID:"+req.body.member_id+" Course ID:"+req.params.id)
      res.json(data)
    }
  })

})

// assign instructor to a course - used by admin only-----------------------------------------------------------
courseRoute.route('/assign-instructor-to-course/:id').put((req, res, next) => {

  //find course and push instructor id to instructors array
  Course.findByIdAndUpdate(req.params.id, {
    $push: {"instructors": req.body.instructor_id}
  }, (error, data) => {
    if (error) {
      return next(error);
      console.log(error)
    } else {

      var cObj = new Object();
      cObj.course = req.params.id;

      //find instructor and push course id to courses
      User.findByIdAndUpdate(req.body.instructor_id, {
        $push: {"courses": cObj}
      }, (error, data) => {
        if (error) {
          return next(error);
          console.log(error)
        }
      })

      console.log('Instructor successfully assigned to the course!')
      //log event
      Log.newLog("Instructor assigned to a course by admin. Instructor ID:"+req.body.instructor_id+" Course ID:"+req.params.id)
      res.json(data)
    }
  })

})

// remove instructor from a course - used by both admin only-----------------------------------------------
courseRoute.route('/remove-instructor-from-course/:id').put((req, res, next) => {

  //find course and remove instructor from the array
  Course.findByIdAndUpdate(req.params.id, {
    $pull: {"instructors": req.body.instructor_id}
  }, (error, data) => {
    if (error) {
      console.log(error);
      return next(error);
    } else {

      //find instructor and remove course from the array
      User.findByIdAndUpdate(req.body.instructor_id, {
        $pull: {"courses": {"course": req.params.id}}
      }, (error, data) => {
        if (error) {
          console.log(error);
          return next(error);
        } else {

        }
      })

      console.log('Instructor successfully removed from the course!')
      //log event
      Log.newLog("Instructor removed from a course by admin. Instructor ID:"+req.body.instructor_id+" Course ID:"+req.params.id)
      res.json(data)
    }
  })

})

// Delete course-----------------------------------------------------------------------------------------------
courseRoute.route('/delete-course/:id').delete((req, res, next) => {

  //find course and delete the membership documents and schedules
  Course.findById(req.params.id, (error, course) => {
    if (error)  return next(error);
    //delete for session membership
    if(course.session_membership != null){
      Membership.findByIdAndRemove(course.session_membership, (error, data) => {
        if (error)  return next(error);
        console.log("session membership has been deleted!");
      })
    }
    //delete for subscription membership
    if(course.subscription_membership != null){
      Membership.findByIdAndRemove(course.subscription_membership, (error, data) => {
        if (error)  return next(error);

        console.log("subscription membership has been deleted!");
      })
    }
    //delete all schedule
    var schedules = course.schedule;
    for (schedule of schedules){
      Schedule.findByIdAndRemove(schedule, (error, data) => {
        if (error)  return next(error);
      })
    }
  });

  //finally, delete the course
  Course.findByIdAndRemove(req.params.id, (error, data) => {
    if (error) {
      return next(error);
    } else {
      //log event
      Log.newLog("Course deleted by admin. Course ID:"+req.params.id+" Course Name:"+data.name)

      res.status(200).json({
        msg: data
      })
    }
  })
})

module.exports = courseRoute;
