/*********************************************************************************
*  Name: JUAN DAVID RODRIGUEZ CASTELBLANCO 
*  Online (Heroku) URL: https://whispering-waters-31442.herokuapp.com/
********************************************************************************/ 
//The server must listen on process.env.PORT || 8080 
const HTTP_PORT = process.env.PORT || 8080;
console.log("Express http server listening on " + HTTP_PORT)
//The server must make use of the "express" module 
const express = require("express");
const app = express();
const multer = require("multer");
const upload = multer();// no { storage: storage } since we are not using disk storage
const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')
const exphbs = require("express-handlebars");

const path = require("path");

const blogService = require('./blog-service.js');
const blogData = require("./blog-service");
const authData = require("./auth-service.js");
const { rmSync } = require("fs");
const stripJs = require('strip-js');
const clientSessions = require("client-sessions");
//middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.set("view engine", ".hbs");
app.use(clientSessions( {
    cookieName: "session",
    secret: "web322_a6",
    duration: 2 * 60 * 1000,
    activeDuration: 1000 * 60
}));

app.use(function(req, res, next) {
    res.locals.session = req.session;
    next();
});

function ensureLogin(req, res, next) {
    if (!req.session.user) {
      res.redirect("/login");
    } else {
      next();
    }
}
app.engine(".hbs", exphbs.engine({ 
    extname: ".hbs",
    helpers: {
        navLink: function(url, options){
            return '<li' +
            ((url == app.locals.activeRoute) ? ' class="active" ' : '') +
            '><a href="' + url + '">' + options.fn(this) + '</a></li>';
           },
        equal: function (lvalue, rvalue, options) {
            if (arguments.length < 3)
            throw new Error("Missing parameters");
            if (lvalue != rvalue) {
            return options.inverse(this);
            } else {
            return options.fn(this);
            }
        },
        safeHTML: function(context){
            return stripJs(context);
           },
        formatDate: function (dateObj) {
        let year = dateObj.getFullYear();
        let month = (dateObj.getMonth() + 1).toString();            let day = dateObj.getDate().toString();
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    }
}));

app.use(function (req, res, next) {
    let route = req.path.substring(1);
    app.locals.activeRoute = "/" + (isNaN(route.split('/')[1]) ? route.replace(/\/(?!.*)/, "") : route.replace(/\/(.*)/, ""));
    app.locals.viewingCategory = req.query.category;
    next();
});
//The route "/" must redirect the user to the "/about"
app.get("/", (req, res) => {
    res.redirect('/blog');
});

app.get("/about", (req, res) => {
    res.render(path.join(__dirname, "/views/about.hbs"));
});


// app.get('/blog', function(req, res){ 
//     blogService.getPublishedPosts().then(
//         function(val){ res.send(blogService.blog);},
//     ).catch(function(err){console.log(err.message)});
// }); 

app.get('/blog', async (req, res) => {

    // Declare an object to store properties for the view
    let viewData = {};

    try{

        // declare empty array to hold "post" objects
        let posts = [];

        // if there's a "category" query, filter the returned posts by category
        if(req.query.category){
            // Obtain the published "posts" by category
            posts = await blogData.getPublishedPostsByCategory(req.query.category);
        }else{
            // Obtain the published "posts"
            posts = await blogData.getPublishedPosts();
        }

        // sort the published posts by postDate
        posts.sort((a,b) => new Date(b.postDate) - new Date(a.postDate));

        // get the latest post from the front of the list (element 0)
        let post = posts[0]; 

        // store the "posts" and "post" data in the viewData object (to be passed to the view)
        viewData.posts = posts;
        viewData.post = post;

    }catch(err){
        viewData.message = "no results";
    }

    try{
        // Obtain the full list of "categories"
        let categories = await blogData.getCategories();

        // store the "categories" data in the viewData object (to be passed to the view)
        viewData.categories = categories;
    }catch(err){
        viewData.categoriesMessage = "no results"
    }

    // render the "blog" view with all of the data (viewData)
    res.render("blog", {data: viewData})

});


app.get("/categories/add", (req, res) => {
    res.render(path.join(__dirname, "/views/addCategory.hbs"));
});

app.post("/categories/add", (req, res) => {
    blogService.addCategory(req.body).then(() => {
        res.redirect("/categories");
    })
});

app.get("/categories/delete/:id", (req, res) => {
    blogService.deleteCategoryById(req.params.id)
    .then(() => {
        res.redirect("/categories");
    }).catch(err => {
        res.status(500).send("Unable to Remove Category / Category not found");
        console.log(err);
    });
});

app.get("/posts/delete/:id", (req, res) => {
    blogService.deletePostById(req.params.id)
    .then(() => {
        res.redirect("/posts");
    }).catch(err => {
        res.status(500).send("Unable to Remove Post / Post not found");
        console.log(err);
    });
});

app.get("/posts", (req, res) => {
    let category = req.query.category;
    let minDate = req.query.minDate;

    if (category) {
        blogService.getPostsByCategory(category).then(data => {
            if (data.length > 0) {
                res.render("posts", { posts: data });
            }
            else {
                res.render("posts", { message: "no results" });
            }
        })
    }
    else if (minDate != "" && minDate != null) {
        blogService.getPostsByMinDate(minDate).then(data => {
            if (data.length > 0) {
                res.render("posts", { posts: data });
            }
            else {
                res.render("posts", { message: "no results" });
            }
        })
    }
    else {
        blogService.getAllPosts().then(data => {
            if (data.length > 0) {
                res.render("posts", { posts: data });
            }
            else {
                res.render("posts", { message: "no results" });
            }
        })
    }
});
// app.get('/posts', function(req, res){ 
//     blogService.getAllPosts().then(
//         function(val){ res.send(posts); },
//     ).catch(function(err){console.log(err.message)});
// });

app.get("/categories", (req, res) => {
    blogService.getCategories().then(data => {
        if (data.length > 0) {
            res.render("categories", { categories: data });
        }
        else {
            res.render("categories", { message: "no results" });
        }
    })
});
//
app.get("/posts/add", (req, res) => {
    blogService.getCategories()
    .then(data => res.render("addPost", {categories: data}))
    .catch(err => {
        res.render("addPost", {categories: []})
    });    
});

cloudinary.config({
    cloud_name: 'dg21qlo6p',
    api_key: '861694287883439',
    api_secret: 'a6THW0KwsT0AA2Y46cGcVu6dqPI',
    secure: true
});

app.post('/posts/add', upload.single("featureImage"), (req, res) => {
    if (req.file) {
        let streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                let stream = cloudinary.uploader.upload_stream(
                    (error, result) => {
                        if (result) {
                            resolve(result);
                        } else {
                            reject(error);
                        }
                    }
                );

                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });
        };

        async function upload(req) {
            let result = await streamUpload(req);
            console.log(result);
            return result;
        }

        upload(req).then((uploaded) => {
            processPost(uploaded.url);
        });
    } else {
        processPost("");
    }

    function processPost(imageUrl) {
        req.body.featureImage = imageUrl;

        // TODO: Process the req.body and add it as a new Blog Post before redirecting to /posts

        blogService.addPost(req.body).then(() => {
            res.redirect("/posts");
        }).catch(err => {
            res.status(500).send(err);
        })
    }
});

app.get('/post/:value', ensureLogin, (req, res) => {
    blogService.getPostById(req.params.value).then((data) => {
        res.render("post", { post: data })
    }).catch(err => {
        res.render("post", { message: "no results" });
    });
});

app.get('/blog/:id', ensureLogin, async (req, res) => {

    // Declare an object to store properties for the view
    let viewData = {};

    try {
        // declare empty array to hold "post" objects
        let posts = [];

        // if there's a "category" query, filter the returned posts by category
        if (req.query.category) {
            // Obtain the published "posts" by category
            posts = await blogData.getPublishedPostsByCategory(req.query.category);
        } else {
            // Obtain the published "posts"
            posts = await blogData.getPublishedPosts();
        }

        // sort the published posts by postDate
        posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));

        // store the "posts" and "post" data in the viewData object (to be passed to the view)
        viewData.posts = posts;

    } catch (err) {
        viewData.message = "no results";
    }

    try {
        // Obtain the post by "id"
        viewData.post = await blogData.getPostById(req.params.id);
        console.log(viewData.post)
    } catch (err) {
        viewData.message = "no results";
    }

    try {
        // Obtain the full list of "categories"
        let categories = await blogData.getCategories();

        // store the "categories" data in the viewData object (to be passed to the view)
        viewData.categories = categories;
    } catch (err) {
        viewData.categoriesMessage = "no results"
    }

    // render the "blog" view with all of the data (viewData)
    res.render("blog", { data: viewData })
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", (req,res) => {
    authData.registerUser(req.body)
    .then(() => res.render("register", {successMessage: "User created" } ))
    .catch (err => res.render("register", {errorMessage: err, userName:req.body.userName }) )
});

app.post("/login", (req, res) => {
    req.body.userAgent = req.get('User-Agent');
    authData.checkUser(req.body).then((user) => {
        req.session.user = {
            userName: user.userName,
            email: user.email,  
            loginHistory: user.loginHistory 
        }
        res.redirect('/posts');
    }).catch((err) => {
        res.render("login", {errorMessage: err, userName: req.body.userName});
    });
});

app.get("/logout", (req, res) => {
    req.session.reset();
    res.redirect("/");
});

app.get("/userHistory", ensureLogin, (req, res) => {
    res.render("userHistory");
});

app.use((req, res) => {
    res.status(404).send("Page Not Found");
});

// setup http server to listen on HTTP_PORT
// app.listen(HTTP_PORT);
blogService.initialize()
    .then(authData.initialize)
    .then(function () {
        app.listen(HTTP_PORT, function () {
            console.log("app listening on: " + HTTP_PORT)
        });
    }).catch(function (err) {
        console.log("unable to start server: " + err);
    }
);
