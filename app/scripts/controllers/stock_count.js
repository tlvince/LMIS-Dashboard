'use strict';

angular.module('lmisApp')
  .controller('StockCountCtrl', function ($scope, $q, $filter, Pagination, Places, ProductType, stockcountUnopened) {
    $scope.rows = [];
    $scope.filteredRows = [];
    $scope.search = {};
    $scope.pagination = new Pagination();
    $scope.totals = [];
    $scope.productTypes = [];
    $scope.loading = true;
    $scope.error = false;
    $scope.places = null;

    $scope.place = {
      type: 0,
      columnTitle: 'Zone',
      search: ''
    };

    $scope.from = {
      opened: false,
      date: moment().startOf('day').subtract('days', 7).toDate(),
      open: function ($event) {
        $event.preventDefault();
        $event.stopPropagation();

        this.opened = true;
      }
    };

    $scope.to = {
      opened: false,
      date: moment().endOf('day').subtract('days', 1).toDate(),
      open: function ($event) {
        $event.preventDefault();
        $event.stopPropagation();

        this.opened = true;
      }
    };

    $scope.getPlaces = function (filter) {
      $scope.places = new Places($scope.place.type, filter);

      return $scope.places.promise;
    };

    $scope.updateTotals = function () {
      var totals = {};
      var filterBy = 'state';
      var groupBy = 'zone';
      var columnTitle = 'Zone';
      switch (parseInt($scope.place.type)) {
        case 1:
          filterBy = 'zone';
          groupBy = 'lga';
          columnTitle = 'LGA';
          break;
        case 2:
          filterBy = 'lga';
          groupBy = 'ward';
          columnTitle = 'Ward';
          break;
        case 3:
          filterBy = 'ward';
          groupBy = 'facility';
          columnTitle = 'Facility';
          break;
        case 4:
          filterBy = 'facility';
          groupBy = 'facility';
          columnTitle = 'Facility';
          break;
      }

      if ($scope.place.search.length) {
        var search = $scope.place.search.toLowerCase();
        $scope.rows.forEach(function (row) {
          if (row[filterBy].toLowerCase() == search) {
            var key = row[groupBy];
            totals[key] = totals[key] || {
              place: key,
              values: {}
            };

            var date = moment(row.created);
            if ((date.isSame($scope.from.date, 'day') || date.isAfter($scope.from.date)) &&
              (date.isSame($scope.to.date, 'day') || date.isBefore($scope.to.date))) {
              var value = totals[key].values[row.productType] || 0;
              totals[key].values[row.productType] = value + row.count;
            }
          }
        });
      }

      $scope.place.columnTitle = columnTitle;
      $scope.totals = Object.keys(totals).map(function (key) {
        var item = totals[key];
        return {
          place: item.place,
          values: $scope.productTypes.map(function (productType) {
            return (item.values[productType] || 0);
          })
        };
      });
    };

    $scope.$watch('search', function () {
      updateFilteredRows();
    }, true);

    function updateFilteredRows() {
      $scope.filteredRows = $filter('filter')($scope.rows, $scope.search);
      $scope.pagination.totalItemsChanged($scope.filteredRows.length);
    }

    $q.all([
        ProductType.codes(),
        stockcountUnopened.all()
      ])
      .then(function (responses) {
        $scope.productTypes = responses[0];

        var rows = responses[1];
        var startState = '';
        var byProductType = {};

        rows
          .filter(function (row) {
            return !!row.facility;
          })
          .forEach(function (row) {
            if (!startState.length || row.facility.state < startState)
              startState = row.facility.state;

            var key = row.facility.uuid + '#' + row.productType + '#' + row.created;
            byProductType[key] = byProductType[key] || {
              state: row.facility.state,
              zone: row.facility.zone,
              lga: row.facility.lga,
              ward: row.facility.ward,
              facility: row.facility.name,
              created: row.created,
              modified: row.modified,
              productType: row.productType,
              count: 0
            };

            byProductType[key].count += row.count;
          });

        $scope.rows = Object.keys(byProductType).map(function (key) {
          return byProductType[key];
        });

        $scope.place.search = startState;
        $scope.updateTotals();
        updateFilteredRows();
      })
      .catch(function () {
        $scope.error = true;
      })
      .finally(function () {
        $scope.loading = false;
      });
  });
