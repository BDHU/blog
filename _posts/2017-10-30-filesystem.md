---
layout: post
title: "File System Design"
categories: "2017"
tags: os
description: "What exactly is a file system? The general concept is that the file system provides naming organization. It manages the physical disk layout such as picking a block constituting a file, balancing locality with expandability, and managing free space. It can translate from file name and offset to the actual data block. In a nutshell, it is a servant that manages all the dirty details of communicating the data between system and the hardware in an optimal way which you aren't required to understand so you can go on and do other things with your life. So what are the functionalities of file systems? In general, it providses file name organizations such as directories. It can manage disk layout by picking blocks that constitute a file, balancing locality with expandability, and manage free space. It can translate from file name and offset to the actual data block."
comments: true
---

What exactly is a file system? The general concept is that the file system provides naming organization. It manages the physical disk layout such as picking a block constituting a file, balancing locality with expandability, and managing free space. It can translate from file name and offset to the actual data block. In a nutshell, it is a servant that manages all the dirty details of communicating the data between system and the hardware in an optimal way which you aren't required to understand so you can go on and do other things with your life. So what are the functionalities of file systems? In general, it providses file name organizations such as directories. It can manage disk layout by picking blocks that constitute a file, balancing locality with expandability, and manage free space. It can translate from file name and offset to the actual data block.
<!--description-->

## File

Let's start from and bottom-to-top pattern to describe file system by first introducing the most fundamental unit: the file itself. So a file is composed of two parts: the metadata and the actual data. The metadata is a *file header* that holds information about where the data is stored and attributes of the file such as a permission, access time, owner id, size, and so on. One thing to note is that meta data blocks are stored on a location that is known by the OS and thus it can be accessed without having to check another data structure. Then the actual data is the part users actually care about. There are two kinds of blocks (there can be more than these two data blocks but we will only discuss two here), The directory data block which maps file names to file headers, and file data block that contains information we care about.

## Design File Layout
There are several factors we need to take into consideration when designing file layout:
* Support for sequential and random access. Almost every file operation is either sequential or random.
* Lay out the files on the physical disk.
* Maintain file location information. This makes sense since we need an agent to keep track all files because we users are too lazy to do that.
* In Unix most files are small in size so we need to support small files, which means block size can't be too large due to internal fagmentation.
* Most disk space is consumed by large files so we also need to support large files and accessing them should be effcient as well.
* I/O operations target both types of files.

## Block VS Sector
Before we dig deeper into file system design, it's important to note the the block size of file system is different from disk blocks size. According to [Practical File System Design](http://www.nobius.org/~dbg/practical-file-system-design.pdf),
block is the smallest unit writable by a disk or ﬁle system. Everything a ﬁle system does is composed of operations done on blocks. A ﬁle system block is always the same size as or larger (in integer multiples) than the disk block size. Also each blocks consists of consecutive sectors so that sequential access becomes possible. A larger block size increases transfer efficiency also because of sequential access since you don't have to move the head too many times, it may be convenient if the block size matches the machine's page size, this is because we don't have to switch pages assuming the block is bigger than the page size. Many systems allows transfer of many sectors between interrupts.

## Allocation methods

#### Contiguous Allocation
* OS maintains an ordered list of free disk blocks.
* OS allocates a contiguous chunk of free blocks when it creates a file.
* Placement/allocation policy can be first-fit, best-fit, or worst-fit.
* File header specifies starting block and length.
* Pros: 
    - All file data stored contiguously on disk.
    - Simple to implement as bump pointer is a common way of implementation.
    - Best performance for initial write of a file due to locality resulted from contiguous allocaiton.
* Cons:
    - External fragmentation because some allocation for large files are simply impossible, resulting in wasted unallocated space, and hard to grow file in size.
    - Later writes may cause the file to grow which would require it to be copied and moved.

#### Linked Allocation
* Files are stored as a linked list of blocks, in each sector, there's a pointer pointing to the next sector. (This is a hardware implementation, we still use blocks fot later discussion.)
* The file header keeps a pointer to the first and last sector/block allocated to that file.
* There are two types of implementations for Linked allocation:
    - Linked list of disk blocks, data blocks point to other blocks
    - Linked list in a table (FAT file system)
* Pros:
    - Reduce or eliminate external fragmentation since blocks can fit in if there are free blocks available.
    - Easy to grow file just like adding elements into a linked list.
    - Linear access is somewhat efficient(It's linked list, what do you expect? O(1)?).
* Cons:
    - linear random access time in linked list.

### FAT File System (File Allocation Table)
FAT32 file system is very important file system created by Microsoft. It was introduced the solve the volume problem posed by FAT16. Although named FAT32, only 28 of the 32 bits are actually used and the remaining 4 bits are "reserved for future use". As a result, a FAT32 partition has a maximum cluster count of (268,435,455)2^28-1. I found this discription about FAT32 on [StackExchange](https://superuser.com/questions/983139/why-is-fat32-limited-to-just-under-228-clusters) that is useful:

>Although VFAT was a clever system, it did not address the limitations of With the appearance of the FAT32 file system, the maximum number of clusters per partition went increased from 65535 to 268,435,455 (228-1). FAT32 thus allows much bigger partitions (up to 8 terabytes). Although the maximum theoretical size of a FAT32 partition is 8 TB, Microsoft has voluntarily limited it to 32 GB on Windows 9x systems to promote NTFS

FAT32 is implemented in a completely different way . Unlike FFS in UNIX, each entry in in the MTF merely represents a block of data. Each block is able to point to another block, with multiple entries in the table to represent a file represented multiple blocks. Each file's file number is indicated using the index of the first entry in the MTF. Thus, in order to locate a specific block of a file, we need to search the MTF sequentially.
