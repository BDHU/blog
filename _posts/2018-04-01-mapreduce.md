---
layout: post
title: "Map Reduce"
categories: "2018"
tags: os
comments: true
---
I was always interested by the name "map reduce" since two years ago when I first heard this term. But I've never put any effor to know the concept until Chris mentioned it in class because it will be on the next exam so I figured I'd better figure out what is going on before it was too late. Just kidding:) But map reduce does borrows a lot of characteristics from traditional relational databases even though many useful and important features in RDBMS are elinimated from the map reduce system. You can check this long list of roasts on map reduce [here](http://www.cs.utexas.edu/~rossbach/cs378/papers/dewitt08blog-mapreduce-backwards.pdf).
<!--description-->

But the intention of this post is not about roasting map reduce so if you absolutely resent how map reduce is such a disgrace to RDBMS you are in the wrong place. Essetnially, MapReduce is a programming model. Users need to define a *map* function that processes a key/value pair, producing a set of key/valuie pairs, then a *reduce* function will read these intermediate pair, merging pairs with the same intermediate key. It is important to realize the MapReduce is a programming model because it allows the programmers to follow this model without having to worry about the technical details needed to ensure the operations between clusters. In fact, the programming model is very easy to understand. Everything you need is already summarized in the name *MapReduce*.

Basically, the computation takes a set of pair/key values are input and output a set of pair/key values. The users write the map function which take an input pair and produce a set of intermediate key/value pairs(we will know why the output in *intermediate*). The MapReduce library takes all intermediate pairs and group the ones with the same key and pass them to the reduce function. The reduce function is also written by the user. It takes an intermediate key with a set of values corresponding to that key, merging those values in hope to form a smaller set of values. What it means is that the reduce function usually produces zero or just one output value. The intermediate values are supplied to reduce function via an iterator. There might be occasions where the memory doesn't have enough space for all intermediate value and thus some values needs to be pushed to permenant storage.
