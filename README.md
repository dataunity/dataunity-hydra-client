AnguarJS Hydra Client
=====================

*Warning: Work in progress. Not suitable for production use (yet).*
*Major Issue: The API Document rel link hasn't been implemented yet (the client reads the API Doc from a static URL).*
*Major Issue: The client is untested against any other API other than the Data Unity one.*
*Major Issue: The client has not tests (sorry!).*

This Hydra client is designed to give a Single Page Application interface to a Hydra Hypermedia API.

Why do we need another Hydra client?
------------------------------------
Markus Lanthaler has already created an official Hydra Console. Please look at that first before using this client. This client differs slightly from the official one:

* the output is designed to be useable by regular end users (Single Page Application)
* it should be transparent to the end user that Hydra is being used
* it is written in AngularJS
* the client has an extension mechanism to supply your own views when the default view isn't what you want

This client writes user friendly HTML to the page.

Some updates are coming soon which let you specify CSS classes to use for SupportedClasses/SupportedProperties to allow the output to be formatted.

AngularJS Routes
----------------

The client works by taking responses from the Hydra API, then uses an appropriate route and controller to handle the response.

The client has three AngularJS routes: collection, item and form. If the Hydra API returns a regular hydra:SupportedClass then the client will use the 'item' route. If the API returns a hydra:Collection or hydra:PagedCollection then the 'collection' route will be used. If the client is processing a SupportedOperation, then the 'form' route is used.

[Note: this behaviour is subject to change. I'm not finding it flexible enough for some scenarios]


Extension Mechanism
-------------------
Sometimes you might want to override the default behaviour of the client and supply your own view. There is an extension mechanism to intercept the responses which match certain hydra:SupportedClasses. More details to follow.
