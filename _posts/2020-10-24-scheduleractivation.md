---
layout: post
title: "Scheduler Activation"
last_modified_at: 25 Oct, 2020
categories: "2020"
description: "What is a thread? A thread of execution is the smallest sequence of programmed instructions that can be managed independently by a scheduler."
tags: os kernel
comments: true
---

What is a thread? A thread of execution is the smallest sequence of programmed instructions that can be managed independently by a scheduler.

## Kernel Level Threads Pros/Cons

* Good functionality, system wide integration
* Threads are seen and scheduled only by the kernel. A lot of kernel information should be invisible to user thread and can be useful for scheduling
* Poor performance, every thread_related call traps. This situation is a lot worse in the 1990s than it is now mainly due to clock speed.
The scheduling quanta are roughly the same, but because the clock speeds are much faster today, you can execute orders of magnitude more instructions
per quanta today than you could in 1990. Even if traps, let's say, costs 10 cycles to complete, it would be a much bigger fraction of the quanta in 1990 than
it is today.

## User Level Threads Pros/Cons

* Good performances. (most threads operations don't involve kernel)
* Good scheduling policy flexibility: done by thread lib
* Poor system-wide integration
* Multi-programmed workloads are hard to schedule
* I/O, page faults invisible
* Potetntial for incorrect behavior
  * User level scheduler may not be cooperative. With user threads running on kernel threads, it may be that kernel threads block when a user-thread blocks, thus an application can run out of kernel threads to run their user threads.May be gilding the lily.

## Some Problems about User-Level Threads on Kernel Interface

* Insufficient visibility between the kernel and user thread lib
* Kernel event such as pr-emption or I/O are not visible to user lib
  * For example, if user level threads block, then the kernel thread serving it also blocks.
* Kernel threads are scheduled with respect to user-level thread library, we can have this interferences between two schedulers.
* Kernel time-slicing of threads
  * For example, user level threads holding a spin-lock can be pre-empted, which can potentially cause all other user threads to wait.

## Scheduler Activation

The basic principle about scheduler actication is to expose revocation: telling me when you take something away. This is basically the same idea as the exokernel. For example, interfaces like

* add_processor()
* has_blocked()

The basics about scheudler activation are

* Multi-threaded programs are still given an address space
* Facilitate flow of kernel information between user and kernel threads
* Kernel explicily vectors kernel events to the user-level thread
  * via scheduler activation (upcall)
* Extended kernel interface for processor allcoation-related events
  * Essentially exchanging information

## Scheduler Activation vs Kernel Threads

Key differences:

* Pre-empted threads never resumed by the kernel direcly.
  * Essentially, every new SA is a brand new context.
  * For example, if you do blocking I/O, the kernel will provide a new scheduling activagtion and vector into that application space. There isn't a notion of "resume". The kernel is simply going to find some new schedule activation to notify you that a work has unblocked. In modern kernels, you would do somehting like stack unwinding to get back into user space.

An important problem is what happened if a user thread is forced to be de-scheduler while it's in a scheduler. The user thread will hold a a lock on user level run queue. That means no other user thread can be scheduled to run because none of them can acquire the lock. Because there's no notion of "resume" in scheduling activation, we can't really resume the execution in the scheduler. Thus, we run into a deadlock situation.

One solution is to detect whether we are using a lock and keep executing until we leave the locked region. Of course, there are too many gotchas in this solution.

Another solution is that the kernel can make a copy of the critical section and execute the critical section itself regardless of what the user thread chooses to do. Therefore, we can guarantee by the time you vector back into user space the lock is no longer held. So the kernel is basically executing the user code! Crazy, right?
Now we ran into more gotchas. What if the code is written in Java? How to find a locked region in userspace? What if ...

Another thing we want to mention is page fault. Page fault indicates that you are missing part of your address. So there will be a notification with a new scheduler activation. Once you do soemthing with it, you will liekly touch that same piece in the space and double fault again.

What is the solution?
