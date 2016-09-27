// script.js

// create the module and name it app
var app = angular.module("pomodoApp", ["ngRoute", "xeditable"]);

// configure our routes
app.config(function($routeProvider) {
    $routeProvider
    .when("/", {
        templateUrl : 'pages/home.html',
        controller  : 'homeController'
    })
    .when("/tasks", {
        templateUrl : 'pages/tasks.html',
        controller  : 'tasksController'
    })
    .when("/projects", {
        templateUrl : 'pages/projects.html',
        controller  : 'projectController'
    })
    .when("/locations", {
        templateUrl : 'pages/locations.html',
        controller  : 'locationController'
    })
    .when("/account", {
        templateUrl : 'pages/user.html',
        controller  : 'userController'
    });
});

app.run(function($rootScope, $http, $window) {
    // keep user logged in after page refresh
   // if ($window.sessionStorage.token) {
   //     $http.defaults.headers.common.Authorization = 'Bearer ' + $window.sessionStorage.token;
   // }

    // redirect to login page if not logged in and trying to access a restricted page
    $rootScope.$on('$locationChangeStart', function (event, next, current) {
   		if (!$window.sessionStorage.token) {
        	$window.location.href = '/angular_jwt_auth_sample/login.html';
        }
    });
});

   
//to change page logo and name
app.run(['$rootScope',function($rootScope){
  $rootScope.changeTitle = function(name, icon) {
    $rootScope.pageInitial = {
      pageTitle: name,
      pageIcon: icon
    };
  } 
}]);

app.factory('AuthenticationService', function($http, $window) {
	var service = {};

        service.Login = Login;
        service.Logout = Logout;

        return service;

        function Login(username, password, callback) {
        	$http.post('test.cgi', { username: username, password: password })
        	//$http.get('/4d/authenticate?username='+username+'&password='+password)
                .success(function (response) {
                    // login successful if there's a token in the response
                    if (response.token) {
                        // store token in storage to keep user logged in between page refreshes
                        $window.sessionStorage.token = response.token;
						
                        // add jwt token to auth header for all requests made by the $http service
                        //$http.defaults.headers.common.Authorization = 'Bearer ' + response.token;

                        // execute callback with true to indicate successful login
                        callback(true);
                    } else {
                        // execute callback with false to indicate failed login
                        callback(false);
                    }
                });
        }

        function Logout() {
            // remove user from storage and clear http auth header
            delete $window.sessionStorage.token;
            $http.defaults.headers.common.Authorization = '';
        }
});

//directive
app.directive("datepicker", function () {
  return {
    restrict: "A",
    require: "ngModel",
    link: function (scope, elem, attrs, ngModelCtrl) {
      var updateModel = function (dateText) {
        scope.$apply(function () {
          ngModelCtrl.$setViewValue(dateText);
        });
      };
      var options = {
        dateFormat: "dd/mm/yy",
        onSelect: function (dateText) {
          updateModel(dateText);
        }
      };
      elem.datepicker(options);
    }
  }
});

//login page
app.controller('validateCtrl', function(AuthenticationService, $scope, $http, $window) {
   	$scope.username = 'John Doe';
    $scope.password = '';
    $scope.error_msg = "";
    if ($window.sessionStorage.token) {
    	$window.sessionStorage.token='';
    	delete $window.sessionStorage.token;
    }
    $scope.authenticate_user = function() {
    	AuthenticationService.Login($scope.username, $scope.password, function (result) {
            if (result === true) {
               $window.location.href = '/angular_jwt_auth_sample/index.html';
            } else {
                $scope.error_msg = 'Username or password is incorrect';
            }
        });
    }
});

// create the controller and inject Angular's $scope
app.controller('NavigationCtrl', ['$scope', '$location', function ($scope, $location) {
    $scope.isCurrentPath = function (path) {
    	return $location.path() == path;
    };
}]);

//dashboard page
app.controller('homeController', function($scope, $http) {
	$scope.changeTitle('Dashboard', 'fa fa-dashboard');
});


//user Page
app.controller('userController', function($scope, $http) {
	$scope.changeTitle('My account', 'fa fa-users');
	$scope.submitForm = function() {
		// check to make sure the form is completely valid
        if ($scope.userForm.$valid) {
            alert('submit this form');
        }
     };
});

app.controller('tasksController', function($scope, $http) {
	$scope.changeTitle('Tasks', 'fa fa-tasks');
	$scope.confirmationBox=false;
	$scope.loadData = function () {
		$http({
			method : "GET",
        	url : "tasks.js"
   		}).then(function mySucces(response) {
    		$scope.contentList = response.data.aaData;
    	});
    };
    
    //load locations
    $scope.loadData();
	    
    // reset Task entry form
    $scope.reset_form = function() {
     	$scope.Title="";
     	$scope.Notes="";
     	$scope.LocationID="";
     	$scope.ProjectID="";
     	$scope.datepicker="";
    }
    
    //edit task
    $scope.edit_content = function(val) {
    	$scope.Title=val.Title;
     	$scope.Notes=val.Notes;
     	$scope.LocationID=val.Location;
     	$scope.ProjectID=val.Project;
     	$scope.datepicker=val.DueDate;
     	$scope.ID=val.ID;
    }
    
    //save data
    $scope.save_data = function() {
    	var data = $.param({
    		ID: $scope.ID,
            Title: $scope.Title,
            Notes: $scope.Notes,
            DueDate: $scope.datepicker,
            LocationID : $scope.LocationID,
            ProjectID : $scope.ProjectID
         });
     	 var config = {
            headers : {
                 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8;'
            }
        }
	
        $http.post('/save/task/@', data, config)
        .success(function (data, status, headers, config) {
            // display response
            console.log(data);
            
            //reload content
            $scope.loadData();
        })
        .error(function (data, status, header, config) {
            console.log(status);
        });
    }
    
    //delete_confirmation 
    $scope.delete_confirmation = function(val) {
    	$scope.confirmationBox=true;
    	$scope.removeID=val;
    }
    
    //remove task from the list
    $scope.remove_task = function() {
    	var removeTaskID= $scope.removeID;
    	if(removeTaskID!=""){
    		$scope.removeID="";
     		var index = -1;		
			var tasksArr = eval( $scope.contentList );
			for( var i = 0; i < tasksArr.length; i++ ) {
				if( tasksArr[i].ID === removeTaskID ) {
					index = i;
					break;
				}
			}
			if( index === -1 ) {
				alert( "Something gone wrong" );
			}
			$scope.contentList.splice( index, 1 );
			$scope.confirmationBox=false;
			console.log("This item has been removed from the database.");	
		}else{
			alert( "Something gone wrong" );
		}
    }
});

// Location Controller

app.run(function(editableOptions) {
  editableOptions.theme = 'bs3';
});

app.controller('locationController', function($scope, $http) {
	$scope.changeTitle('Locations', 'fa fa-map-marker');
	
	$scope.loadData = function () {
		$http({
			method : "GET",
        	url : "locations.js"
   		}).then(function mySucces(response) {
    		$scope.contentList = response.data.aaData;
    	});
    };
    
    //load locations
    $scope.loadData();
     
    // reset Task entry form
    $scope.reset_form = function() {
     	$scope.Name="";
     	
    }
    //validation
    $scope.checkLocationName = function(data, id) {
    	if (data == '') {
      		return "Location name is required!";
    	}
  	};
    $scope.save_location = function(data) {
    	console.log("Values saved");
     	 var config = {
            headers : {
                 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8;'
            }
        }
	
        $http.post('/save/location/@', data, config)
        .success(function (data, status, headers, config) {
            // display response
            console.log(data);
            
            //reload content
            $scope.loadData();
        })
        .error(function (data, status, header, config) {
            console.log(status);
        });
    }
    
    // save new location
    $scope.save_new_location = function() {
     	var data = $.param({
            Name: $scope.Name
         });
        $scope.save_location(data);
    }
    
    // save the values
    $scope.save_existing_location = function(data, id) {
    	var data = $.param({
             ID: id,
            Name: data
        });
        $scope.save_location(data);

    }
      
    //remove task from the list
    $scope.remove_location = function(val) {
     	var index = -1;		
		var tasksArr = eval( $scope.contentList );
		for( var i = 0; i < tasksArr.length; i++ ) {
			if( tasksArr[i].ID === val ) {
				index = i;
				break;
			}
		}
		if( index === -1 ) {
			alert( "Something gone wrong" );
		}
		$scope.contentList.splice( index, 1 );
		console.log("This item has been removed from the database.");	
    }
});

// project Controller
app.controller('projectController', function($scope, $http) {
	$scope.changeTitle('Projects', 'fa fa-archive');
	$scope.confirmationBox=false;
	
	$scope.loadData = function () {
		$http({
        	method : "GET",
        	url : "projects.js"
    	}).then(function mySucces(response) {
    		$scope.contentList = response.data.aaData;
    	});
    };
    
    //load projects
    $scope.loadData();
    
    // reset Task entry form
    $scope.reset_form = function() {
     	$scope.Name="";
     	$scope.Notes="";
    }
    
    //edit task
    $scope.edit_content = function(val) {
    	$scope.Name=val.Name;
     	$scope.Notes=val.Notes;
    }
    
    //save data
    $scope.save_data = function(data) {
    	var data = $.param({
    		ID : $scope.ID,
            Name: $scope.Name,
            Notes: $scope.Notes
         });
    	console.log("Values saved");
     	 var config = {
            headers : {
                 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8;'
            }
        }
	
        $http.post('/save/project/@', data, config)
        .success(function (data, status, headers, config) {
            // display response
            console.log(data);
            
            //reload content
            $scope.loadData();
        })
        .error(function (data, status, header, config) {
            console.log(status);
        });
    }
	
	//delete_confirmation 
    $scope.delete_confirmation = function(val) {
    	$scope.confirmationBox=true;
    	$scope.removeID=val;
    }
    
    //remove item from the list
    $scope.remove_project = function() {
    	var removeItemID= $scope.removeID;
    	if(removeItemID!=""){
    		$scope.removeID="";
     		var index = -1;		
			var tasksArr = eval( $scope.contentList );
			for( var i = 0; i < tasksArr.length; i++ ) {
				if( tasksArr[i].ID === removeItemID ) {
					index = i;
					break;
				}
			}
			if( index === -1 ) {
				alert( "Something gone wrong" );
			}
			$scope.contentList.splice( index, 1 );
			
			$scope.confirmationBox=false;
			console.log("This item has been removed from the database.");	
		}else{
			alert( "Something gone wrong" );
		}
    }
});